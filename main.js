
// main.js
const platformClient = window.platformClient;
const client = platformClient.ApiClient.instance;

function getConfig() {
  return fetch('/api/getConfig', { cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error('Environment vars could not be retrieved'); return r.json(); });
}

// נרמול מספרים (E.164 עדיף)
function normalizeNumber(n) { return (n || '').replace(/[^\d+]/g, ''); }

// פס סטטוס
function showStatus(message, variant = 'success', autoHideMs = 2500) {
  const el = document.getElementById('statusMessage');
  if (!el) return;
  el.className = `status-message status-message--${variant} status-message--visible`;
  el.textContent = message;
  document.getElementById('body').style.display = 'block';
  if (autoHideMs) {
    clearTimeout(el.__t);
    el.__t = setTimeout(() => hideStatus(), autoHideMs);
  }
}
function hideStatus() {
  const el = document.getElementById('statusMessage');
  if (!el) return;
  el.classList.remove('status-message--visible');
  setTimeout(() => { el.style.display = 'none'; el.textContent = ''; }, 250);
}

async function start() {
  try {
    const config = await getConfig();                          // { GCclientId, DDIlist }
    await startGCSDKs(config.GCclientId);                      // OAuth בדפדפן

    // אם קיבלנו conversationId מה-URL (מה-Widget) — רוץ ישירות
    if (window.conversationId) {
      await getConversationAndCheckDNIS(config.DDIlist);
    } else {
      // fallback (לא חובה כרגע): להאזין לנוטיפיקציות עד שתחובר שיחה
      await subscribeConversationsAndAutoMute(config.DDIlist);
    }
  } catch (e) {
    console.error('Auto-mute: start error', e);
    showStatus('שגיאה באתחול – בדוק OAuth/ENV', 'error', 4000);
  }
}

async function subscribeConversationsAndAutoMute(DDIlist) {
  const notificationsApi = new platformClient.NotificationsApi();
  const usersApi = new platformClient.UsersApi();
  const me = await usersApi.getUsersMe();

  const channel = await notificationsApi.postNotificationsChannels();
  const ws = new WebSocket(channel.connectUri);

  const topic = `v2.users.${me.id}.conversations`;
  await notificationsApi.putNotificationsChannelSubscriptions(channel.id, [{ id: topic }]);

  showStatus('מחובר לנוטיפיקציות…', 'info', 1200);

  ws.onmessage = async ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.topicName !== topic || !msg.eventBody) return;

    const conv = msg.eventBody;
    const agent = (conv.participants || []).find(p => p.purpose === 'agent');
    const connected = agent && (agent.state === 'connected' || agent.connectedTime);

    if (connected) {
      window.conversationId = conv.id;
      await getConversationAndCheckDNIS(DDIlist);
    }
  };
  // הערוץ הרשמי לקבלת אירועים בזמן אמת לאפליקציות UI הוא Notifications WebSocket.
  // [2](https://developer.genesys.cloud/notificationsalerts/notifications/)
}

function getConversationAndCheckDNIS(DDIlist) {
  let apiInstance = new platformClient.ConversationsApi();
  console.log("Auto-mute: getConversationAndCheckDNIS started");

  apiInstance.getConversation(window.conversationId)
    .then((data) => {
      console.log("Auto-mute: Conversation data:", data);

      let customerDNIS, agentParticipantId;
      for (let participant of (data.participants || [])) {
        if (participant.purpose === 'customer') {
          customerDNIS = participant.dnis || participant.address || null;
        } else if (participant.purpose === 'agent') {
          agentParticipantId = participant.id;
        }
      }

      const list = (DDIlist || '').split(';').map(s => normalizeNumber(s.trim()));
      const dnisNorm = normalizeNumber(customerDNIS);

      if (list.includes(dnisNorm) && agentParticipantId) {
        console.log("Auto-mute: DNIS found in DDIlist, muting call.");
        muteAgent(agentParticipantId);
      } else {
        console.log("Auto-mute: DNIS not found in DDIlist or no agent found, not muting.", { dnisNorm, list });
      }
    })
    .catch((err) => {
      console.log("Auto-mute: getConversation failed:", err);
      showStatus('כשל בקבלת נתוני שיחה', 'error', 3000);
    });
}

function muteAgent(agentParticipantId) {
  let apiInstance = new platformClient.ConversationsApi();
  let conversationId = window.conversationId;
  let body = { muted: true };

  // guard למניעת mute כפול
  window.__mutedConvs ||= new Set();
  if (window.__mutedConvs.has(conversationId)) return;

  apiInstance.patchConversationsCallParticipant(conversationId, agentParticipantId, body)
    .then(() => {
      console.log("Auto-mute: patchConversationsCallParticipant OK");
      window.__mutedConvs.add(conversationId);
      showStatus('Call muted', 'success', 2500);
      document.getElementById('body').style.display = 'block';
    })
    .catch((err) => {
      console.log("Auto-mute: patchConversationsCallParticipant failed:", err);
      showStatus('Mute failed – see console', 'error', 4000);
    });
}

