// Service Worker for SignalFlow Extension

chrome.runtime.onInstalled.addListener(() => {
  console.log('SignalFlow Extension Installed.');
});

// We will use this in Checkpoint 3 to bypass CSP when communicating with the CRM API.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PING') {
    sendResponse({ status: 'OK' });
    return true;
  }

  if (request.type === 'FORCE_SYNC') {
    console.log("[FORCE_SYNC] Initiated");
    chrome.tabs.query({ url: [
      "https://signalflow-crm.vercel.app/*",
      "https://mrhomes-crm.vercel.app/*",
      "http://localhost:3000/*"
    ]}, (tabs) => {
      console.log("[FORCE_SYNC] Tabs query returned: ", JSON.stringify(tabs?.map(t => ({ id: t.id, url: t.url, status: t.status, title: t.title }))));
      
      if (!tabs || tabs.length === 0) {
        chrome.tabs.create({ url: 'https://signalflow-crm.vercel.app/' }, () => {
          sendResponse({ success: false, error: 'No open CRM tab found. Opened signalflow-crm.vercel.app - please log in.' });
        });
        return;
      }
      
      const tab = tabs[0];
      console.log("[FORCE_SYNC] Selected tabId:", tab.id);
      console.log("[FORCE_SYNC] Selected tab URL:", tab.url);
      console.log("[FORCE_SYNC] Selected tab status:", tab.status);
      
      if (tab.id) {
        const executeParams = {
          target: { tabId: tab.id },
          func: () => {
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
                    });
                    return { success: true, email: session.user?.email };
                  }
                }
              }
              return { success: false, error: 'Supabase session not found in tab localStorage. Please log in.' };
            } catch (e: any) {
              return { success: false, error: e.message };
            }
          }
        };
        
        console.log("[FORCE_SYNC] Exact chrome.scripting.executeScript parameters:", JSON.stringify({
          tabId: executeParams.target.tabId,
          hasFunc: typeof executeParams.func === 'function'
        }));
        
        try {
          chrome.scripting.executeScript(executeParams, (results) => {
            if (chrome.runtime.lastError) {
              console.error("[FORCE_SYNC] chrome.runtime.lastError detected:", chrome.runtime.lastError.message);
              sendResponse({ success: false, error: chrome.runtime.lastError.message });
              return;
            }
            if (results && results[0] && results[0].result) {
              const res = results[0].result as any;
              if (res.success) {
                sendResponse({ success: true, message: `Successfully synced session for ${res.email}` });
              } else {
                sendResponse({ success: false, error: res.error });
              }
            } else {
              sendResponse({ success: false, error: 'Script execution failed.' });
            }
          });
        } catch (scriptError: any) {
          console.error("[FORCE_SYNC] Exception caught calling executeScript:", scriptError);
          console.error("[FORCE_SYNC] Stack trace:", scriptError.stack);
          sendResponse({ success: false, error: `executeScript threw: ${scriptError.message}` });
        }
      } else {
        sendResponse({ success: false, error: 'Invalid active tab ID' });
      }
    });
    return true;
  }

  if (request.type === 'ANALYZE' || request.type === 'SYNC' || request.type === 'RECOMMENDATIONS') {
    chrome.storage.local.get(['supabase_token', 'crm_domain'], async (result) => {
      const token = result.supabase_token;
      const crmDomain = result.crm_domain || 'https://signalflow-crm.vercel.app';
      
      let url = '';
      let options: RequestInit = {
        headers: {
          'Authorization': `Bearer ${token || ''}`
        }
      };

      if (!token) {
        sendResponse({ 
          success: false, 
          error: `Unauthorized: No token found. Please log in to Mr Homes at ${crmDomain}` 
        });
        return;
      }

      try {
        if (request.type === 'ANALYZE') {
          url = `${crmDomain}/api/signalflow/analyze`;
          options.method = 'POST';
          options.headers = {
            ...options.headers,
            'Content-Type': 'application/json'
          };
          options.body = JSON.stringify(request.payload);
        } else if (request.type === 'SYNC') {
          url = `${crmDomain}/api/signalflow/sync`;
          options.method = 'POST';
          options.headers = {
            ...options.headers,
            'Content-Type': 'application/json'
          };
          options.body = JSON.stringify(request.payload);
        } else if (request.type === 'RECOMMENDATIONS') {
          url = `${crmDomain}/api/signalflow/recommendations?lead_id=${request.payload.leadId}`;
          options.method = 'GET';
        }

        console.log("---------------- SIGNALFLOW API REQUEST ----------------");
        console.log("URL:", url);
        console.log("METHOD:", options.method || 'GET');
        console.log("REQUEST HEADERS:", JSON.stringify(options.headers));
        if (options.body) {
          console.log("REQUEST BODY:", options.body);
        }

        const response = await fetch(url, options);
        const status = response.status;
        const contentType = response.headers.get("content-type") || 'unknown';

        console.log("RESPONSE STATUS:", status);
        console.log("RESPONSE CONTENT-TYPE:", contentType);

        const rawText = await response.text();
        console.log("RAW RESPONSE:", rawText);

        const isJson = contentType.includes("application/json");

        if (!isJson) {
          console.error(`EXPECTATION FAILED: Expected JSON. Received: ${contentType}`);
          sendResponse({ 
            success: false, 
            error: `Unexpected Content-Type: Expected JSON, received "${contentType}"`,
            debugInfo: {
              url,
              method: options.method || 'GET',
              status,
              contentType,
              responseText: rawText.substring(0, 1000)
            }
          });
          return;
        }

        const data = JSON.parse(rawText);

        if (status === 401) {
          sendResponse({ 
            success: false, 
            error: `Unauthorized: Session expired. Please refresh the page at ${crmDomain}`,
            debugInfo: {
              url,
              method: options.method || 'GET',
              status,
              contentType,
              responseText: rawText.substring(0, 500)
            }
          });
        } else if (!response.ok) {
          sendResponse({ 
            success: false, 
            error: data.error || `Server Error (HTTP ${status})`,
            debugInfo: {
              url,
              method: options.method || 'GET',
              status,
              contentType,
              responseText: rawText.substring(0, 500)
            }
          });
        } else {
          sendResponse({ success: true, data });
        }
      } catch (err: any) {
        console.error("FETCH EXCEPTION:", err);
        sendResponse({ 
          success: false, 
          error: err.message || `Connection to ${crmDomain} failed. Check if server is running.`,
          debugInfo: {
            url: url || `${crmDomain}/api/signalflow/...`,
            method: options.method || 'GET',
            status: 0,
            contentType: 'network-error',
            responseText: err.stack || err.message || String(err)
          }
        });
      }
    });
    return true; // Keep channel open for async sendResponse
  }
  return true;
});
