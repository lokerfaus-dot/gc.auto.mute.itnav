
// startGCSDKs.js
function startGCSDKs(clientId) {
  return new Promise(async (resolve, reject) => {
    try {
      const appName = 'Auto mute';

      // שמות פרמטרים שמגיעים מה-Interaction Widget
      const qParamLanguage       = 'langTag';
      const qParamGcHostOrigin   = 'gcHostOrigin';
      const qParamEnvironment    = 'gcTargetEnv';
      const qParamConversationId = 'conversationId';

      // ה-redirect שצריך להיות רשום ב-OAuth Client שלך
      const redirectUri = window.location.origin;

      // קריאת פרמטרים
      const sp     = new URLSearchParams(window.location.search);
      const fromLs = (k) => localStorage.getItem(`${appName}_${k}`) || '';
      const toLs   = (k,v) => v && localStorage.setItem(`${appName}_${k}`, v);

      let language     = sp.get(qParamLanguage)     || fromLs('language')    || '';
      let gcHostOrigin = sp.get(qParamGcHostOrigin) || fromLs('gcHostOrigin')|| '';
      toLs('language', language);
      toLs('gcHostOrigin', gcHostOrigin);

      const conversationId = sp.get(qParamConversationId) || '';
      if (conversationId) {
        window.conversationId = conversationId;
        console.log('Conversation ID from URL:', conversationId);
      }

      // === Environment ===
      // תקבל מ-Widget: gcTargetEnv = "euw2.pure.cloud"
      // ואם לא — נגזור מ-gcHostOrigin, ונגדיר fallback
      let environment = sp.get(qParamEnvironment) || '';
      if (!environment && gcHostOrigin) {
        const host = new URL(gcHostOrigin).hostname; // apps.euw2.pure.cloud
        environment = host.split('.').slice(1).join('.'); // euw2.pure.cloud
      }
      if (!environment) environment = 'euw2.pure.cloud';

      // === SDK בדפדפן (ללא require) ===
      const platformClient = window.platformClient;
      const client   = platformClient.ApiClient.instance;
      const usersApi = new platformClient.UsersApi();

      // Client App SDK (מומלץ בווידג'ט)
      const ClientApp = window.purecloud?.apps?.ClientApp;
      let myClientApp = null;
      if (ClientApp) {
        myClientApp = new ClientApp({
          pcEnvironment: environment,
          gcHostOriginQueryParam: qParamGcHostOrigin,
          gcTargetEnvQueryParam: qParamEnvironment
        });
        window.myClientApp = myClientApp;
      }

      // === OAuth (User context) ===
      client.setPersistSettings(true, appName);
      client.setEnvironment(environment);            // <-- חשוב: "euw2.pure.cloud"
      await client.loginImplicitGrant(clientId, redirectUri);  // נדרש לשליטת קול  [1](https://community.genesys.com/discussion/error-when-using-apiv2conversationscalls-in-data-action)

      const me = await usersApi.getUsersMe();

      // עדכון UI קטן (לא חובה)
      const envEl  = document.getElementById('span_environment');
      const langEl = document.getElementById('span_language');
      const nameEl = document.getElementById('span_name');
      if (envEl)  envEl.innerText  = environment;
      if (langEl) langEl.innerText = language || '-';
      if (nameEl) nameEl.innerText = me.name || '';

      // חשיפה ל-main.js
      window.__gcCtx = { platformClient, client, usersApi, me, myClientApp, environment };

      resolve(platformClient);
    } catch (err) {
      console.error('Error during setup:', err);
      reject(err);
    }
  });
}
``
