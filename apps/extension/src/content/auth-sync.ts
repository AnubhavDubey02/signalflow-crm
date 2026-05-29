console.log("SignalFlow Auth Sync Script Loaded");

function syncSession() {
  try {
    const keys = Object.keys(localStorage);
    const authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (authKey) {
      const sessionStr = localStorage.getItem(authKey);
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session && session.access_token) {
          chrome.storage.local.set({ 
            supabase_token: session.access_token,
            user_email: session.user?.email || 'Unknown',
            last_sync_time: new Date().toLocaleString(),
            crm_domain: window.location.origin
          }, () => {
            console.log("SignalFlow: Synced active session token to extension storage.");
          });
        }
      }
    }
  } catch (e) {
    console.error("SignalFlow auth sync error:", e);
  }
}

// Run immediately
syncSession();

// Listen for local storage changes
window.addEventListener('storage', (e) => {
  if (e.key && e.key.startsWith('sb-') && e.key.endsWith('-auth-token')) {
    syncSession();
  }
});
