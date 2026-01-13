const platformClient = require('platformClient');
const client = platformClient.ApiClient.instance;

function getConfig() {
    return fetch('/api/getConfig')
        .then(response => {
            if (!response.ok) {
                throw new Error('Environment vars could not be retrieved');
            }
            return response.json();
        });
}

async function start() {
    try {
        const config = await getConfig();
        await startGCSDKs(config.GCclientId);
        console.log("Auto-mute: retrieved clientId in start: ", config.GCclientId);
        getConversationAndCheckDNIS(config.DDIlist);
    } catch (error) {
        console.error('Auto-mute: Error occurred while starting:', error);
    }
}

function getConversationAndCheckDNIS(DDIlist) {
    console.log("Auto-mute: getConversationAndCheckDNIS started");
    let apiInstance = new platformClient.ConversationsApi();

    apiInstance.getConversation(window.conversationId)
        .then((data) => {
            console.log("Auto-mute: Conversation data:", data);
            let participants = data.participants;
            console.log("Auto-mute: Participants:", participants);
            let customerDNIS;
            let agentParticipantId;
            for (let participant of participants) {
                if (participant.purpose === 'customer') {
                    customerDNIS = participant.dnis;
                    console.log("Auto-mute: Customer DNIS:", customerDNIS);
                } else if (participant.purpose === 'agent') {
                    agentParticipantId = participant.id;
                    console.log("Auto-mute: Setting agentParticipantId:", agentParticipantId);
                }
            }
            // Convert DDIlist from string to array and trim spaces
            let DDIarray = DDIlist.split(';').map(DDI => DDI.trim());
            // Check if DNIS is within DDIlist and if there's an agentParticipantId
            if (DDIarray.includes(customerDNIS) && agentParticipantId) {
                console.log("Auto-mute: DNIS found in DDIlist, muting call.");
                muteAgent(agentParticipantId); // Mute the agent if DNIS is in DDIlist
            } else {
                console.log("Auto-mute: DNIS not found in DDIlist or no agent found, not muting.");
            }
        })
        .catch((err) => {
            console.log("Auto-mute: There was a failure calling getConversation:", err);
        });
}

function muteAgent(agentParticipantId) {
    let apiInstance = new platformClient.ConversationsApi();
    let conversationId = window.conversationId;
    let participantId = agentParticipantId; 
    let body = {"muted": true}; 

    apiInstance.patchConversationsCallParticipant(conversationId, participantId, body)
        .then(() => {
            console.log("Auto-mute: patchConversationsCallParticipant returned successfully.");
            // Ensure body is visible
            document.getElementById('body').style.display = 'block'; // Add this line
            // Ensure the status message is visible
            const statusMessageElement = document.getElementById('statusMessage');
            statusMessageElement.style.display = 'block';
            statusMessageElement.innerText = 'Call muted'; 
        })
        .catch((err) => {
            console.log("Auto-mute: There was a failure calling patchConversationsCallParticipant:");
            console.error(err);
        });
}
