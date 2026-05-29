import React, { useState, useEffect } from 'react';
import { WhatsAppParser, ParsedMessage, Diagnostics } from '../whatsapp-parser';
import { 
  User, MessageSquare, Activity, Shield, Cpu, Layers, Check, 
  AlertTriangle, ArrowRight, Save, RefreshCw, MapPin, Calendar, 
  DollarSign, TrendingUp, AlertCircle, Clock, Globe
} from 'lucide-react';

export default function Sidebar() {
  // Current Chat State
  const [leadName, setLeadName] = useState<string | null>(null);
  const [messages, setMessages] = useState<ParsedMessage[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostics>({
    headerFound: false,
    messagesFound: 0,
    selectorsHealthy: false,
    currentSelectorUsed: 'None',
    matchedCount: 0,
    matchedSnippets: [],
    selectorTests: []
  });

  // Auth and Host state from storage
  const [authDetails, setAuthDetails] = useState<{
    tokenPresent: boolean;
    userEmail: string;
    lastSyncTime: string;
    crmDomain: string;
  }>({
    tokenPresent: false,
    userEmail: 'Unknown',
    lastSyncTime: 'Never',
    crmDomain: 'https://signalflow-crm.vercel.app'
  });

  // App States
  const [phone, setPhone] = useState<string>('');
  const [isEditingPhone, setIsEditingPhone] = useState<boolean>(false);
  const [currentContact, setCurrentContact] = useState<string | null>(null);
  const [status, setStatus] = useState<'PREVIEW' | 'ANALYZING' | 'REVIEW' | 'SYNCING' | 'RECOMMENDATIONS'>('PREVIEW');
  const [intelligence, setIntelligence] = useState<any>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [apiDebugInfo, setApiDebugInfo] = useState<{
    url: string;
    method: string;
    status: number;
    contentType: string;
    responseText: string;
  } | null>(null);

  // Sync token details from chrome storage
  useEffect(() => {
    const checkToken = () => {
      chrome.storage.local.get(['supabase_token', 'user_email', 'last_sync_time', 'crm_domain'], (result) => {
        setAuthDetails({
          tokenPresent: !!result.supabase_token,
          userEmail: result.user_email || 'Unknown',
          lastSyncTime: result.last_sync_time || 'Never',
          crmDomain: result.crm_domain || 'https://signalflow-crm.vercel.app'
        });
      });
    };
    checkToken();
    const tokenInterval = setInterval(checkToken, 2000);
    return () => clearInterval(tokenInterval);
  }, []);

  // Poll chat states
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const name = WhatsAppParser.getActiveLeadName();
        setLeadName(name);

        if (name) {
          const msgs = WhatsAppParser.extractMessages(200);
          setMessages((prev) => JSON.stringify(prev) !== JSON.stringify(msgs) ? msgs : prev);
        } else {
          setMessages([]);
        }

        const diags = WhatsAppParser.getDiagnostics();
        setDiagnostics(diags);
      } catch (err) {
        console.error("SignalFlow Parser Error:", err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Reset states on active contact change
  useEffect(() => {
    if (leadName !== currentContact) {
      setCurrentContact(leadName);
      const parsedPhone = WhatsAppParser.getActivePhoneNumber();
      setPhone(parsedPhone || '');
      setIsEditingPhone(false);
      setStatus('PREVIEW');
      setIntelligence(null);
      setError(null);
      setApiDebugInfo(null);
      setLeadId(null);
      setRecommendations([]);
    }
  }, [leadName, currentContact]);

  // API Call: Analyze Chat
  const handleAnalyze = () => {
    try {
      console.log("STEP 1 ENTER HANDLE");
      if (!phone) {
        console.log("STEP 2a: ERROR - NO PHONE");
        setError("Please specify a phone number.");
        return;
      }
      console.log("STEP 2b: VALIDATION PASSED");
      
      setStatus('ANALYZING');
      setError(null);
      setApiDebugInfo(null);
      setSuccessMessage(null);

      const chatPayload = messages.map(m => ({
        sender: m.sender,
        message: m.text,
        timestamp: m.normalizedTimestamp
      }));
      console.log("STEP 3 SENDING MESSAGE, PAYLOAD:", chatPayload);

      chrome.runtime.sendMessage({
        type: 'ANALYZE',
        payload: {
          whatsappPhone: phone,
          chatPayload
        }
      }, (response) => {
        console.log("STEP 4 CALLBACK RECEIVED, RESPONSE:", response);
        if (chrome.runtime.lastError) {
          console.error("STEP 4e: RUNTIME ERROR:", chrome.runtime.lastError);
          setError(chrome.runtime.lastError.message || 'Background worker inactive');
          setStatus('PREVIEW');
          return;
        }
        
        if (!response.success) {
          console.error("STEP 5e: API ERROR:", response.error);
          setError(response.error);
          if (response.debugInfo) {
            setApiDebugInfo(response.debugInfo);
          }
          setStatus('PREVIEW');
        } else {
          console.log("STEP 5 RESPONSE RECEIVED, DATA:", response.data);
          setError(null);
          setApiDebugInfo(null);
          setIntelligence(response.data.data);
          setStatus('REVIEW');
          console.log("STEP 6 REVIEW STATE");
        }
      });
    } catch (err: any) {
      console.error("Exception caught in handleAnalyze:", err);
      setError(err.message || String(err));
      setStatus('PREVIEW');
    }
  };

  // API Call: Sync CRM
  const handleSync = () => {
    try {
      console.log("SYNC STEP 1: ENTER SYNC");
      setStatus('SYNCING');
      setError(null);
      setApiDebugInfo(null);
      setSuccessMessage(null);

      chrome.runtime.sendMessage({
        type: 'SYNC',
        payload: {
          whatsappPhone: phone,
          intelligenceData: intelligence
        }
      }, (response) => {
        console.log("SYNC STEP 2: CALLBACK RECEIVED, RESPONSE:", response);
        if (chrome.runtime.lastError) {
          console.error("SYNC STEP 2e: RUNTIME ERROR:", chrome.runtime.lastError);
          setError(chrome.runtime.lastError.message || 'Background worker inactive');
          setStatus('REVIEW');
          return;
        }
        
        if (!response.success) {
          console.error("SYNC STEP 3e: API ERROR:", response.error);
          setError(response.error);
          if (response.debugInfo) {
            setApiDebugInfo(response.debugInfo);
          }
          setStatus('REVIEW');
        } else {
          console.log("SYNC STEP 3: API SUCCESS, DATA:", response.data);
          setError(null);
          setApiDebugInfo(null);
          const syncedLeadId = response.data.leadId;
          setLeadId(syncedLeadId);
          
          console.log("SYNC STEP 4: FETCHING RECOMMENDATIONS FOR LEAD:", syncedLeadId);
          // Immediately fetch recommendations
          chrome.runtime.sendMessage({
            type: 'RECOMMENDATIONS',
            payload: { leadId: syncedLeadId }
          }, (recResponse) => {
            console.log("SYNC STEP 5: RECOMMENDATIONS CALLBACK:", recResponse);
            if (recResponse.success && recResponse.data.recommendations) {
              setRecommendations(recResponse.data.recommendations);
            }
            setStatus('RECOMMENDATIONS');
          });
        }
      });
    } catch (err: any) {
      console.error("Exception caught in handleSync:", err);
      setError(err.message || String(err));
      if (err.debugInfo) {
        setApiDebugInfo(err.debugInfo);
      }
      setStatus('REVIEW');
    }
  };

  // Trigger Force Sync
  const handleForceSync = () => {
    try {
      setError(null);
      setApiDebugInfo(null);
      setSuccessMessage(null);
      
      if (authDetails.tokenPresent) {
        setSuccessMessage("Session already synced.");
        return;
      }
      
      chrome.runtime.sendMessage({ type: 'FORCE_SYNC' }, (response) => {
        if (chrome.runtime.lastError) {
          setError(chrome.runtime.lastError.message || 'Background worker inactive');
          return;
        }
        if (response && response.success) {
          chrome.storage.local.get(['supabase_token', 'user_email', 'last_sync_time', 'crm_domain'], (result) => {
            setAuthDetails({
              tokenPresent: !!result.supabase_token,
              userEmail: result.user_email || 'Unknown',
              lastSyncTime: result.last_sync_time || 'Never',
              crmDomain: result.crm_domain || 'https://signalflow-crm.vercel.app'
            });
            setSuccessMessage("Session synced successfully.");
          });
        } else {
          setError(response?.error || 'Failed to force sync. Please open the CRM tab and verify you are logged in.');
        }
      });
    } catch (err: any) {
      console.error("Exception caught in handleForceSync:", err);
      setError(err.message || String(err));
    }
  };

  // Event listeners are bound directly via inline callback refs to ensure freshness and bypass Shadow DOM event blocking.

  // Helper for updating nested NextAction values
  const handleNextActionChange = (field: string, value: any) => {
    const nextAction = intelligence.nextAction || { actionType: 'FOLLOW_UP', description: '', dueDate: new Date().toISOString() };
    if (field === 'actionType' && !value) {
      setIntelligence({ ...intelligence, nextAction: null });
    } else {
      setIntelligence({
        ...intelligence,
        nextAction: { ...nextAction, [field]: value }
      });
    }
  };

  const formatDateForInput = (isoString?: string) => {
    if (!isoString) return '';
    return isoString.split('T')[0];
  };

  const handleDateChange = (dateVal: string) => {
    if (!dateVal) return;
    const iso = new Date(dateVal).toISOString();
    handleNextActionChange('dueDate', iso);
  };

  return (
    <>
      {/* 1. VISIBLE FALLBACK UI / DIAGNOSTICS OVERLAY (Glassmorphic design) */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '390px',
        width: '340px',
        background: 'rgba(17, 24, 39, 0.95)',
        backdropFilter: 'blur(12px)',
        color: '#e5e7eb',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        zIndex: 2147483647,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={16} color="#38bdf8" />
            <h2 style={{ color: 'white', margin: 0, fontSize: '15px', fontWeight: 600 }}>SignalFlow Debug</h2>
          </div>
          <span style={{
            background: diagnostics.selectorsHealthy ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: diagnostics.selectorsHealthy ? '#34d399' : '#f87171',
            padding: '2px 10px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 600,
            border: `1px solid ${diagnostics.selectorsHealthy ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
          }}>
            {diagnostics.selectorsHealthy ? 'Healthy' : 'Degraded'}
          </span>
        </div>

        {/* Core Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', background: 'rgba(255, 255, 255, 0.04)', padding: '12px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#9ca3af' }}>Active Chat:</span>
            <span style={{ color: '#f3f4f6', fontWeight: 600 }}>{leadName || 'None'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#9ca3af' }}>Active Selector:</span>
            <span style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: '11.5px', background: 'rgba(56, 189, 248, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
              {diagnostics.currentSelectorUsed}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#9ca3af' }}>Nodes Matched:</span>
            <span style={{ color: '#34d399', fontWeight: 600 }}>{diagnostics.matchedCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#9ca3af' }}>JWT Detected:</span>
            <span style={{ color: authDetails.tokenPresent ? '#34d399' : '#f87171', fontWeight: 600 }}>
              {authDetails.tokenPresent ? 'true' : 'false'}
            </span>
          </div>
        </div>

        {/* Selector Test Mode Counts */}
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 8px 0', letterSpacing: '0.05em', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Layers size={11} /> Selector Tests
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {diagnostics.selectorTests.map((t, idx) => (
              <div key={idx} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: '11.5px', 
                background: t.count > 0 ? 'rgba(52, 211, 153, 0.05)' : 'rgba(255,255,255,0.01)', 
                padding: '5px 8px', 
                borderRadius: '4px',
                borderLeft: t.count > 0 ? '2px solid #34d399' : '2px solid transparent'
              }}>
                <span style={{ fontFamily: 'monospace', color: t.count > 0 ? '#34d399' : '#9ca3af' }}>{t.selectorName}</span>
                <span style={{ color: t.count > 0 ? '#34d399' : '#6b7280', fontWeight: t.count > 0 ? '600' : 'normal' }}>{t.count} nodes</span>
              </div>
            ))}
          </div>
        </div>

        {/* Snippets list */}
        {diagnostics.matchedSnippets.length > 0 && (
          <div>
            <h3 style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 6px 0', letterSpacing: '0.05em', fontWeight: 600 }}>
              Matched Node Snippets (First 3)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
              {diagnostics.matchedSnippets.map((snippet, idx) => (
                <div key={idx} style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  background: '#1f2937',
                  padding: '8px',
                  borderRadius: '6px',
                  borderLeft: '3px solid #38bdf8',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  color: '#cbd5e1'
                }}>
                  {snippet}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. ACTUAL SIDEBAR UI (Premium Theme) */}
      <div className="signalflow-sidebar-container" style={{ 
        position: 'fixed', 
        top: '0', 
        right: '0', 
        width: '370px',
        height: '100vh', 
        background: '#f8fafc', 
        fontSize: '14px', 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        zIndex: 2147483646,
        borderLeft: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 25px rgba(0,0,0,0.06)'
      }}>
        {/* Sidebar Header */}
        <div style={{ 
          background: '#0f172a', 
          color: 'white', 
          padding: '18px 20px', 
          fontWeight: 700, 
          fontSize: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          borderBottom: '1px solid #1e293b'
        }}>
          <Activity size={18} color="#10b981" />
          SignalFlow Extractor
        </div>

        {/* Mini Auth Warning Indicator */}
        {!authDetails.tokenPresent && (
          <div style={{ 
            background: '#fef2f2', 
            color: '#991b1b', 
            padding: '10px 16px', 
            fontSize: '12px', 
            borderBottom: '1px solid #fca5a5',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 500
          }}>
            <AlertCircle size={14} color="#ef4444" />
            <span>Unauthorized. Please log in at <a href={authDetails.crmDomain} target="_blank" style={{ textDecoration: 'underline', color: '#b91c1c' }}>{authDetails.crmDomain.replace('https://', '')}</a>.</span>
          </div>
        )}

        <div style={{ padding: '20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Error Banner */}
          {error && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '12px 14px',
              color: '#991b1b',
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#dc2626' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>Error Occurred</div>
                  <div style={{ marginTop: '2px', fontSize: '12px', opacity: 0.9 }}>{error}</div>
                </div>
                <button 
                  type="button"
                  ref={(el) => {
                    if (el) {
                      if ((el as any)._signalflow_click_listener) {
                        el.removeEventListener('click', (el as any)._signalflow_click_listener);
                      }
                      const listener = () => {
                        setError(null);
                        setApiDebugInfo(null);
                      };
                      (el as any)._signalflow_click_listener = listener;
                      el.addEventListener('click', listener);
                    }
                  }}
                  onClick={() => {
                    setError(null);
                    setApiDebugInfo(null);
                  }}
                  style={{ 
                    border: 'none', 
                    background: 'none', 
                    color: '#991b1b', 
                    cursor: 'pointer', 
                    fontWeight: 'bold', 
                    fontSize: '14px',
                    padding: '0 4px',
                    lineHeight: 1
                  }}
                >
                  Ã—
                </button>
              </div>

              {apiDebugInfo && (
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '10px',
                  color: '#334155',
                  fontFamily: 'monospace',
                  fontSize: '11.5px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', fontWeight: 600, color: '#475569' }}>
                    ðŸ” API DEBUG INFO
                  </div>
                  <div>
                    <span style={{ fontWeight: 600, color: '#64748b' }}>Request URL:</span> {apiDebugInfo.url}
                  </div>
                  <div>
                    <span style={{ fontWeight: 600, color: '#64748b' }}>Method:</span> {apiDebugInfo.method}
                  </div>
                  <div>
                    <span style={{ fontWeight: 600, color: '#64748b' }}>HTTP Status:</span> <span style={{ color: apiDebugInfo.status >= 400 ? '#ef4444' : '#10b981', fontWeight: 600 }}>{apiDebugInfo.status}</span>
                  </div>
                  <div>
                    <span style={{ fontWeight: 600, color: '#64748b' }}>Content-Type:</span> {apiDebugInfo.contentType}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontWeight: 600, color: '#64748b' }}>Raw Response Preview (First 500 chars):</span>
                    <pre style={{
                      margin: '4px 0 0 0',
                      padding: '8px',
                      background: '#0f172a',
                      color: '#38bdf8',
                      borderRadius: '4px',
                      maxHeight: '120px',
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all'
                    }}>
                      {apiDebugInfo.responseText}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )/* Error Banner Close */}

          {/* Success Banner */}
          {successMessage && (
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '8px',
              padding: '12px 14px',
              color: '#065f46',
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <Check size={16} style={{ flexShrink: 0, marginTop: '2px', color: '#059669' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>Success</div>
                  <div style={{ marginTop: '2px', fontSize: '12px', opacity: 0.9 }}>{successMessage}</div>
                </div>
                <button 
                  type="button"
                  ref={(el) => {
                    if (el) {
                      if ((el as any)._signalflow_click_listener) {
                        el.removeEventListener('click', (el as any)._signalflow_click_listener);
                      }
                      const listener = () => {
                        setSuccessMessage(null);
                      };
                      (el as any)._signalflow_click_listener = listener;
                      el.addEventListener('click', listener);
                    }
                  }}
                  onClick={() => setSuccessMessage(null)}
                  style={{ 
                    border: 'none', 
                    background: 'none', 
                    color: '#065f46', 
                    cursor: 'pointer', 
                    fontWeight: 'bold', 
                    fontSize: '14px',
                    padding: '0 4px',
                    lineHeight: 1
                  }}
                >
                  Ã—
                </button>
              </div>
            </div>
          )}

          {/* CONNECTION INFO PANEL */}
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '16px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Connection Info</h4>
              <span style={{
                background: authDetails.tokenPresent ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: authDetails.tokenPresent ? '#10b981' : '#ef4444',
                padding: '2px 8px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 600,
                border: `1px solid ${authDetails.tokenPresent ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
              }}>
                Auth Token Status: {authDetails.tokenPresent ? 'Present' : 'Missing'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', color: '#475569' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={13} color="#64748b" />
                <span style={{ color: '#64748b', width: '70px', flexShrink: 0 }}>Agent Email:</span>
                <span style={{ color: '#1e293b', fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{authDetails.userEmail}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={13} color="#64748b" />
                <span style={{ color: '#64748b', width: '70px', flexShrink: 0 }}>Last Synced:</span>
                <span style={{ color: '#1e293b', fontWeight: 550 }}>{authDetails.lastSyncTime}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={13} color="#64748b" />
                <span style={{ color: '#64748b', width: '70px', flexShrink: 0 }}>CRM Host:</span>
                <span style={{ color: '#3b82f6', fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{authDetails.crmDomain}</span>
              </div>
            </div>

            <button
              type="button"
              ref={(el) => {
                if (el) {
                  if ((el as any)._signalflow_click_listener) {
                    el.removeEventListener('click', (el as any)._signalflow_click_listener);
                  }
                  const listener = (e: MouseEvent) => {
                    console.log("DIRECT DOM CLICK ON FORCE SYNC");
                    handleForceSync();
                  };
                  (el as any)._signalflow_click_listener = listener;
                  el.addEventListener('click', listener);
                }
              }}
              onClick={handleForceSync}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#475569',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
              <RefreshCw size={13} />
              Force Sync Session
            </button>
          </div>

          {/* ==================== STATE 1: PREVIEW ==================== */}
          {status === 'PREVIEW' && (
            <>
              {/* Active Lead */}
              <div>
                <h3 style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 600, letterSpacing: '0.05em' }}>
                  Active Lead
                </h3>
                {leadName ? (
                  <div style={{ 
                    background: 'white', 
                    border: '1px solid #e2e8f0', 
                    padding: '14px 16px', 
                    borderRadius: '10px', 
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: '#f0fdf4',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #dcfce7'
                      }}>
                        <User size={18} color="#15803d" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 650, color: '#0f172a', fontSize: '14.5px' }}>{leadName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Active WhatsApp Chat</div>
                      </div>
                    </div>

                    {/* WhatsApp Phone Info */}
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>WhatsApp Phone:</span>
                        {phone ? (
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                            {phone}
                            <button 
                              onClick={() => setIsEditingPhone(true)} 
                              style={{ border: 'none', background: 'none', color: '#3b82f6', fontSize: '11px', marginLeft: '6px', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              Edit
                            </button>
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#ef4444' }}>Unknown</span>
                        )}
                      </div>

                      {/* Manual Phone Fallback Override */}
                      {(!phone || isEditingPhone) && (
                        <div style={{ marginTop: '8px' }}>
                          <input 
                            type="text" 
                            placeholder="Enter Phone (e.g. +919876543210)"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            style={{ 
                              width: '100%', 
                              padding: '8px 10px', 
                              border: '1px solid #cbd5e1', 
                              borderRadius: '6px', 
                              fontSize: '12.5px',
                              boxSizing: 'border-box'
                            }}
                          />
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                            âš ï¸ Required to analyze lead
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ 
                    color: '#94a3b8', 
                    fontStyle: 'italic', 
                    background: '#f8fafc', 
                    border: '1px dashed #cbd5e1', 
                    padding: '16px', 
                    borderRadius: '10px',
                    textAlign: 'center'
                  }}>
                    Please select a chat inside WhatsApp...
                  </div>
                )}
              </div>

              {/* Action Button */}
              {leadName && (
                <button
                  ref={(el) => {
                    if (el) {
                      if ((el as any)._signalflow_click_listener) {
                        el.removeEventListener('click', (el as any)._signalflow_click_listener);
                      }
                      const listener = (e: MouseEvent) => {
                        console.log("DIRECT DOM CLICK ON ANALYZE: Triggering handleAnalyze", { phone, messagesCount: messages.length });
                        alert("ANALYZE BUTTON CLICKED");
                        handleAnalyze();
                      };
                      (el as any)._signalflow_click_listener = listener;
                      el.addEventListener('click', listener);
                    }
                  }}
                  onClick={() => {
                    console.log("ANALYZE BUTTON CLICKED");
                    alert("ANALYZE BUTTON CLICKED");
                    handleAnalyze();
                  }}
                  disabled={!phone || !authDetails.tokenPresent}
                  style={{
                    background: '#0f172a',
                    color: 'white',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '8px',
                    fontWeight: 650,
                    cursor: (!phone || !authDetails.tokenPresent) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: (!phone || !authDetails.tokenPresent) ? 0.5 : 1,
                    transition: 'all 0.15s ease'
                  }}
                >
                  Analyze Conversation
                  <ArrowRight size={16} />
                </button>
              )}

              {/* Parsed Message List */}
              {leadName && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <h3 style={{ 
                    fontSize: '11px', 
                    color: '#64748b', 
                    textTransform: 'uppercase', 
                    marginBottom: '10px', 
                    fontWeight: 600, 
                    letterSpacing: '0.05em',
                    display: 'flex', 
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span>Payload Preview</span>
                    <span style={{ 
                      color: '#10b981', 
                      background: '#f0fdf4', 
                      padding: '2px 8px', 
                      borderRadius: '12px', 
                      fontSize: '10.5px',
                      border: '1px solid #dcfce7',
                      fontWeight: 600
                    }}>
                      {messages.length} Extracted
                    </span>
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {messages.length > 0 ? (
                      messages.map((msg, i) => (
                        <div key={i} style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          background: msg.sender === 'AGENT' ? '#f0fdf4' : 'white',
                          border: msg.sender === 'AGENT' ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                          alignSelf: msg.sender === 'AGENT' ? 'flex-end' : 'flex-start',
                          maxWidth: '88%',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                        }}>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            fontSize: '10px', 
                            color: msg.sender === 'AGENT' ? '#15803d' : '#64748b', 
                            marginBottom: '4px', 
                            fontWeight: 600 
                          }}>
                            <span>{msg.sender}</span>
                            <span style={{ marginLeft: '10px', fontWeight: 'normal' }}>{msg.rawTimestamp}</span>
                          </div>
                          <div style={{ color: '#1e293b', fontSize: '13px', lineHeight: '1.4', wordBreak: 'break-word' }}>
                            {msg.text}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '12px', padding: '10px 0' }}>
                        No messages matched or parsed. Check selector debug panel.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ==================== STATE 2: ANALYZING (LOADING STATE) ==================== */}
          {status === 'ANALYZING' && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '60px 20px', 
              gap: '16px',
              textAlign: 'center'
            }}>
              <RefreshCw size={36} color="#3b82f6" className="animate-spin" style={{ animation: 'spin 1.5s linear infinite' }} />
              <div>
                <h4 style={{ fontWeight: 600, color: '#0f172a', margin: '0 0 6px 0' }}>Extracting Intelligence...</h4>
                <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>OpenAI is analyzing the conversation details against property models.</p>
              </div>
            </div>
          )}

          {/* ==================== STATE 3: REVIEW SCREEN ==================== */}
          {status === 'REVIEW' && intelligence && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, margin: 0 }}>
                  Review Extracted Requirements
                </h3>
                <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600 }}>Step 2 of 3</span>
              </div>

              {/* FORM FIELDS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'white', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                {/* Requirement Summary */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569' }}>Requirement Summary</label>
                  <textarea 
                    rows={3}
                    value={intelligence.requirementSummary || ''} 
                    onChange={e => setIntelligence({...intelligence, requirementSummary: e.target.value})}
                    style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', resize: 'vertical' }}
                  />
                </div>

                {/* Transaction Type */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569' }}>Transaction Type</label>
                  <select 
                    value={intelligence.transactionType} 
                    onChange={e => setIntelligence({...intelligence, transactionType: e.target.value})}
                    style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
                  >
                    <option value="RENT">Rent</option>
                    <option value="BUY">Buy</option>
                  </select>
                </div>

                {/* Property Types Checklist */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569' }}>Property Types</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {['STUDIO', '1BHK', '2BHK', '3BHK', '4BHK', 'PLOT', 'COMMERCIAL', 'PG', 'CO_LIVING'].map(type => {
                      const isSelected = (intelligence.propertyTypes || []).includes(type);
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            const current = intelligence.propertyTypes || [];
                            const next = current.includes(type)
                              ? current.filter((t: string) => t !== type)
                              : [...current, type];
                            setIntelligence({ ...intelligence, propertyTypes: next });
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            border: isSelected ? '1px solid #10b981' : '1px solid #cbd5e1',
                            background: isSelected ? '#ecfdf5' : 'white',
                            color: isSelected ? '#047857' : '#475569',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.1s ease'
                          }}
                        >
                          {type}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Budgets */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <DollarSign size={11} /> Budget Min (â‚¹)
                    </label>
                    <input 
                      type="number" 
                      value={intelligence.budgetMin || ''} 
                      onChange={e => setIntelligence({...intelligence, budgetMin: e.target.value ? parseInt(e.target.value) : null})}
                      style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <DollarSign size={11} /> Budget Max (â‚¹)
                    </label>
                    <input 
                      type="number" 
                      value={intelligence.budgetMax || ''} 
                      onChange={e => setIntelligence({...intelligence, budgetMax: e.target.value ? parseInt(e.target.value) : null})}
                      style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
                    />
                  </div>
                </div>

                {/* Preferred Sectors */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <MapPin size={11} /> Preferred Sectors
                  </label>
                  <input 
                    type="text" 
                    placeholder="Sector 45, Sector 52"
                    value={(intelligence.preferredSectors || []).join(', ')} 
                    onChange={e => setIntelligence({
                      ...intelligence, 
                      preferredSectors: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    })}
                    style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
                  />
                </div>

                {/* Landmarks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569' }}>Landmarks</label>
                  <input 
                    type="text" 
                    placeholder="Near rapid metro, Cyber City"
                    value={(intelligence.landmarks || []).join(', ')} 
                    onChange={e => setIntelligence({
                      ...intelligence, 
                      landmarks: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    })}
                    style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
                  />
                </div>

                {/* Furnishing & Occupant */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569' }}>Furnishing</label>
                    <select 
                      value={intelligence.furnishing || ''} 
                      onChange={e => setIntelligence({...intelligence, furnishing: e.target.value || null})}
                      style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
                    >
                      <option value="">Unspecified</option>
                      <option value="FULLY">Fully Furnished</option>
                      <option value="SEMI">Semi Furnished</option>
                      <option value="UNFURNISHED">Unfurnished</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569' }}>Occupant Type</label>
                    <select 
                      value={intelligence.occupantType || ''} 
                      onChange={e => setIntelligence({...intelligence, occupantType: e.target.value || null})}
                      style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
                    >
                      <option value="">Unspecified</option>
                      <option value="BACHELOR">Bachelor</option>
                      <option value="FAMILY">Family</option>
                      <option value="COUPLE">Couple</option>
                    </select>
                  </div>
                </div>

                {/* Move-in Timeline & Lead Temperature */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569' }}>Move-In Timeline</label>
                    <input 
                      type="text" 
                      placeholder="Immediate, 1 week"
                      value={intelligence.moveInTimeline || ''} 
                      onChange={e => setIntelligence({...intelligence, moveInTimeline: e.target.value || null})}
                      style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <TrendingUp size={11} /> Temperature
                    </label>
                    <select 
                      value={intelligence.leadTemperature} 
                      onChange={e => setIntelligence({...intelligence, leadTemperature: e.target.value})}
                      style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600 }}
                    >
                      <option value="HOT" style={{ color: '#ef4444', fontWeight: 'bold' }}>ðŸ”¥ HOT</option>
                      <option value="WARM" style={{ color: '#f59e0b', fontWeight: 'bold' }}>âš¡ WARM</option>
                      <option value="COLD" style={{ color: '#3b82f6', fontWeight: 'bold' }}>â„ï¸ COLD</option>
                    </select>
                  </div>
                </div>

                {/* Next Action Task */}
                <div style={{ borderTop: '1px solid #cbd5e1', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={12} /> Follow-up Action
                  </label>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Action Type</span>
                    <select 
                      value={intelligence.nextAction?.actionType || ''} 
                      onChange={e => handleNextActionChange('actionType', e.target.value || null)}
                      style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
                    >
                      <option value="">None / Discard Action</option>
                      <option value="SITE_VISIT">Site Visit</option>
                      <option value="CALL">Call Client</option>
                      <option value="SHARE_INVENTORY">Share Inventory Options</option>
                      <option value="FOLLOW_UP">Follow Up</option>
                    </select>
                  </div>

                  {intelligence.nextAction && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Action Description</span>
                        <input 
                          type="text" 
                          placeholder="Call back to schedule visit"
                          value={intelligence.nextAction.description || ''} 
                          onChange={e => handleNextActionChange('description', e.target.value)}
                          style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Due Date</span>
                        <input 
                          type="date" 
                          value={formatDateForInput(intelligence.nextAction.dueDate)} 
                          onChange={e => handleDateChange(e.target.value)}
                          style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* SAVE / RESET ACTIONS */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  ref={(el) => {
                    if (el) {
                      if ((el as any)._signalflow_click_listener) {
                        el.removeEventListener('click', (el as any)._signalflow_click_listener);
                      }
                      const listener = (e: MouseEvent) => {
                        console.log("DIRECT DOM CLICK ON BACK");
                        setStatus('PREVIEW');
                      };
                      (el as any)._signalflow_click_listener = listener;
                      el.addEventListener('click', listener);
                    }
                  }}
                  onClick={() => setStatus('PREVIEW')}
                  style={{
                    flex: 1,
                    background: 'white',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    padding: '12px 0',
                    borderRadius: '8px',
                    fontWeight: 650,
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  Back
                </button>
                
                <button
                  ref={(el) => {
                    if (el) {
                      if ((el as any)._signalflow_click_listener) {
                        el.removeEventListener('click', (el as any)._signalflow_click_listener);
                      }
                      const listener = (e: MouseEvent) => {
                        console.log("DIRECT DOM CLICK ON SYNC: Triggering handleSync", { phone, tokenPresent: authDetails.tokenPresent });
                        alert("SAVE BUTTON CLICKED");
                        handleSync();
                      };
                      (el as any)._signalflow_click_listener = listener;
                      el.addEventListener('click', listener);
                    }
                  }}
                  onClick={() => {
                    console.log("REACT SYNTHETIC CLICK: Sync Button Clicked - STATE:", { phone, tokenPresent: authDetails.tokenPresent, intelligence });
                    alert("SAVE BUTTON CLICKED");
                    handleSync();
                  }}
                  disabled={!authDetails.tokenPresent}
                  style={{
                    flex: 2,
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    padding: '12px 0',
                    borderRadius: '8px',
                    fontWeight: 650,
                    cursor: !authDetails.tokenPresent ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    opacity: !authDetails.tokenPresent ? 0.5 : 1
                  }}
                >
                  <Save size={16} />
                  Save to CRM (Sync)
                </button>
              </div>
            </div>
          )}

          {/* ==================== STATE 4: SYNCING (LOADING CRM STATE) ==================== */}
          {status === 'SYNCING' && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '60px 20px', 
              gap: '16px',
              textAlign: 'center'
            }}>
              <RefreshCw size={36} color="#10b981" className="animate-spin" style={{ animation: 'spin 1.5s linear infinite' }} />
              <div>
                <h4 style={{ fontWeight: 600, color: '#0f172a', margin: '0 0 6px 0' }}>Syncing with Supabase...</h4>
                <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>Creating lead data model, linking intelligence log, and generating matching tasks.</p>
              </div>
            </div>
          )}

          {/* ==================== STATE 5: RECOMMENDATIONS SCREEN ==================== */}
          {status === 'RECOMMENDATIONS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ 
                background: '#ecfdf5', 
                border: '1px solid #a7f3d0', 
                color: '#065f46',
                padding: '14px 16px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
              }}>
                <Check size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#059669' }} />
                <div>
                  <div style={{ fontWeight: 650, fontSize: '13.5px' }}>CRM Synced Successfully</div>
                  <div style={{ fontSize: '11.5px', marginTop: '2px', opacity: 0.9 }}>Lead was created/updated. Follow-up tasks scheduled.</div>
                </div>
              </div>

              {/* Recommendations header */}
              <div>
                <h3 style={{ 
                  fontSize: '11px', 
                  color: '#64748b', 
                  textTransform: 'uppercase', 
                  marginBottom: '10px', 
                  fontWeight: 600, 
                  letterSpacing: '0.05em' 
                }}>
                  Inventory Recommendations
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {recommendations.length > 0 ? (
                    recommendations.map((rec) => (
                      <div key={rec.id} style={{
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        padding: '14px',
                        borderRadius: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: 650, color: '#0f172a', fontSize: '13.5px', lineHeight: '1.3' }}>
                            {rec.title}
                          </span>
                          <span style={{ 
                            background: '#f1f5f9', 
                            color: '#475569', 
                            padding: '2px 6px', 
                            borderRadius: '8px', 
                            fontSize: '10.5px',
                            fontWeight: 600,
                            flexShrink: 0
                          }}>
                            Score: {rec.match_score}
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '8px', fontSize: '11.5px', color: '#64748b' }}>
                          <span>{rec.type}</span>
                          <span>â€¢</span>
                          <span>{rec.sector}</span>
                        </div>

                        <div style={{ 
                          fontSize: '14px', 
                          fontWeight: 700, 
                          color: '#059669', 
                          borderTop: '1px solid #f1f5f9', 
                          paddingTop: '6px',
                          marginTop: '2px' 
                        }}>
                          â‚¹{rec.price.toLocaleString()} / mo
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ 
                      color: '#94a3b8', 
                      fontStyle: 'italic', 
                      background: '#f8fafc', 
                      border: '1px dashed #cbd5e1', 
                      padding: '20px', 
                      borderRadius: '10px',
                      textAlign: 'center',
                      fontSize: '13px'
                    }}>
                      No matching properties found in inventory.
                    </div>
                  )}
                </div>
              </div>

              {/* RESET BUTTON */}
              <button
                ref={(el) => {
                  if (el) {
                    if ((el as any)._signalflow_click_listener) {
                      el.removeEventListener('click', (el as any)._signalflow_click_listener);
                    }
                    const listener = (e: MouseEvent) => {
                      console.log("DIRECT DOM CLICK ON SCAN ANOTHER CHAT");
                      setStatus('PREVIEW');
                    };
                    (el as any)._signalflow_click_listener = listener;
                    el.addEventListener('click', listener);
                  }
                }}
                onClick={() => setStatus('PREVIEW')}
                style={{
                  background: '#0f172a',
                  color: 'white',
                  border: 'none',
                  padding: '12px 0',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '10px'
                }}
              >
                Scan Another Chat
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}


