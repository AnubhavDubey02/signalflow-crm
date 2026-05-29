'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Safe initialization of Supabase client in browser
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Basic parser for raw WhatsApp string to ChatMessage[] format
function parseRawWhatsAppToPayload(rawText: string) {
  const lines = rawText.split('\n');
  const payload = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    // Extremely rudimentary regex for testing purposes: [date] sender: message
    // QA must format input loosely as "Agent: Hello" or "Lead: I want 1BHK"
    const isAgent = line.toLowerCase().includes('agent:');
    payload.push({
      sender: isAgent ? 'AGENT' : 'LEAD',
      message: line.replace(/^(agent|lead):\s*/i, '').trim(),
      timestamp: new Date().toISOString()
    });
  }
  return payload;
}

export default function LabConsole() {
  // Input fields
  const [phone, setPhone] = useState('+919876543210');
  const [rawChat, setRawChat] = useState('Agent: Looking for a rental?\nLead: 1bhk in 52 under 25k');
  
  // Pipeline state
  const [status, setStatus] = useState<'IDLE' | 'ANALYZING' | 'REVIEW' | 'SYNCING' | 'DONE'>('IDLE');
  const [intelligence, setIntelligence] = useState<any>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Authentication syncing states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authStatus, setAuthStatus] = useState<string>('Checking...');
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Load and listen to active localStorage sessions
  useEffect(() => {
    const checkLocalSession = () => {
      try {
        const keys = Object.keys(localStorage);
        const authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        if (authKey) {
          const sessionStr = localStorage.getItem(authKey);
          if (sessionStr) {
            const parsed = JSON.parse(sessionStr);
            setCurrentSession(parsed);
            setAuthStatus(`Logged In as ${parsed.user?.email || 'Unknown'}`);
            return;
          }
        }
        setCurrentSession(null);
        setAuthStatus('Logged Out / No Session');
      } catch (err: any) {
        setAuthStatus(`Session error: ${err.message}`);
      }
    };

    checkLocalSession();

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
        checkLocalSession();
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  const handleSignIn = async () => {
    if (!supabase) return;
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  };

  const handleSignUp = async () => {
    if (!supabase) return;
    setAuthError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setAuthError(error.message);
    else alert('Check your email for confirmation link!');
  };

  const handleSignOut = async () => {
    setAuthError(null);
    if (supabase) {
      await supabase.auth.signOut();
    }
    const keys = Object.keys(localStorage);
    const authKey = keys.find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (authKey) {
      localStorage.removeItem(authKey);
    }
    window.location.reload();
  };

  const handleGenerateDevSession = () => {
    try {
      const mockSession = {
        access_token: 'STUB_TOKEN',
        user: {
          id: 'dev-agent-id-123',
          email: 'developer@signalflow.com'
        }
      };
      localStorage.setItem('sb-dev-auth-token', JSON.stringify(mockSession));
      window.dispatchEvent(new Event('storage'));
      window.location.reload();
    } catch (err: any) {
      setAuthError(`Failed to write mock session: ${err.message}`);
    }
  };

  // Pipeline handlers
  const handleAnalyze = async () => {
    setStatus('ANALYZING');
    setError(null);
    try {
      const chatPayload = parseRawWhatsAppToPayload(rawChat);
      const token = currentSession?.access_token || 'STUB_TOKEN';
      const res = await fetch('/api/signalflow/analyze', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ whatsappPhone: phone, chatPayload })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to analyze');
      
      setIntelligence(json.data);
      setStatus('REVIEW');
    } catch (e: any) {
      setError(e.message);
      setStatus('IDLE');
    }
  };

  const handleSync = async () => {
    setStatus('SYNCING');
    setError(null);
    try {
      const token = currentSession?.access_token || 'STUB_TOKEN';
      const res = await fetch('/api/signalflow/sync', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ whatsappPhone: phone, intelligenceData: intelligence })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to sync');
      
      setLeadId(json.leadId);
      
      // Immediately fetch recommendations
      const recRes = await fetch(`/api/signalflow/recommendations?lead_id=${json.leadId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const recJson = await recRes.json();
      if (recRes.ok && recJson.recommendations) {
        setRecommendations(recJson.recommendations);
      }
      
      setStatus('DONE');
    } catch (e: any) {
      setError(e.message);
      setStatus('REVIEW');
    }
  };

  return (
    <div className="space-y-8">
      {/* AUTH SYNCHRONIZATION PANEL */}
      <div className="bg-white p-6 shadow rounded-lg border border-gray-200 space-y-4">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Chrome Extension Auth Sync</h2>
            <p className="text-sm text-gray-500 mt-1">Generate or sync active credentials to your browser's localStorage for the SignalFlow extension.</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${currentSession ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
            {authStatus}
          </span>
        </div>

        {authError && (
          <div className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">{authError}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Option A: Real Supabase Auth */}
          <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Option A: Supabase Authentication
            </h3>
            
            {supabase ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Email</label>
                    <input 
                      type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="agent@example.com"
                      className="mt-1 block w-full p-2 text-sm border border-gray-300 rounded bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Password</label>
                    <input 
                      type="password" value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="mt-1 block w-full p-2 text-sm border border-gray-300 rounded bg-white"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={handleSignIn}
                    className="flex-1 bg-blue-600 text-white text-xs p-2 rounded font-medium hover:bg-blue-700"
                  >
                    Log In
                  </button>
                  <button 
                    onClick={handleSignUp}
                    className="flex-1 bg-white text-blue-600 text-xs p-2 rounded font-medium border border-blue-600 hover:bg-blue-50"
                  >
                    Sign Up
                  </button>
                  {currentSession && (
                    <button 
                      onClick={handleSignOut}
                      className="bg-gray-200 text-gray-700 text-xs p-2 rounded font-medium hover:bg-gray-300"
                    >
                      Sign Out
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded border border-amber-100 leading-relaxed">
                ⚠️ Supabase environment variables are missing on Vercel. Standard Supabase login is disabled. Please configure <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable.
              </div>
            )}
          </div>

          {/* Option B: Mock Development Session */}
          <div className="space-y-3 p-4 bg-emerald-50/50 rounded-lg border border-emerald-100 flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Option B: Developer Mock Session
              </h3>
              <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                Generate a simulated local token (`STUB_TOKEN`) instantly. This acts as a fallback for offline development, local debugging, or when Supabase keys are not present.
              </p>
            </div>
            
            <div className="flex gap-2 pt-4">
              <button 
                onClick={handleGenerateDevSession}
                className="flex-1 bg-emerald-600 text-white text-xs p-2 rounded font-medium hover:bg-emerald-700"
              >
                Generate Dev Token
              </button>
              {currentSession && (
                <button 
                  onClick={handleSignOut}
                  className="bg-gray-200 text-gray-700 text-xs p-2 rounded font-medium hover:bg-gray-300"
                >
                  Clear Session
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* LEFT: INPUT */}
        <div className="bg-white p-6 shadow rounded-lg space-y-4 border border-gray-200">
          <h2 className="text-xl font-semibold">1. Input Chat</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">WhatsApp Phone</label>
            <input 
              type="text" value={phone} onChange={e => setPhone(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Raw Chat Text</label>
            <textarea 
              rows={10} value={rawChat} onChange={e => setRawChat(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded font-mono text-sm"
            />
          </div>

          <button 
            onClick={handleAnalyze} disabled={status === 'ANALYZING'}
            className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {status === 'ANALYZING' ? 'Running OpenAI Extraction...' : 'Analyze Chat Pipeline'}
          </button>

          {error && <div className="p-4 bg-red-50 text-red-700 rounded border border-red-200">{error}</div>}
        </div>

        {/* RIGHT: OUTPUT & SYNC */}
        <div className="bg-white p-6 shadow rounded-lg space-y-4 border border-gray-200">
          <h2 className="text-xl font-semibold">2. Pipeline Results</h2>

          {status === 'IDLE' && <p className="text-gray-500 italic">Awaiting input...</p>}

          {intelligence && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">Extracted Intelligence</h3>
              <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-64">
                {JSON.stringify(intelligence, null, 2)}
              </pre>

              {(status === 'REVIEW' || status === 'SYNCING') && (
                <button 
                  onClick={handleSync} disabled={status === 'SYNCING'}
                  className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {status === 'SYNCING' ? 'Saving to Supabase...' : 'Save to CRM (Sync API)'}
                </button>
              )}
            </div>
          )}

          {status === 'DONE' && (
            <div className="space-y-4 mt-6">
              <div className="p-4 bg-green-50 text-green-700 rounded border border-green-200">
                ✓ Synced successfully. Lead ID: {leadId}
              </div>

              <h3 className="font-medium text-gray-900 border-b pb-2">Inventory Recommendations</h3>
              {recommendations.length === 0 ? (
                <p className="text-gray-500 text-sm">No matching properties found.</p>
              ) : (
                <ul className="space-y-2">
                  {recommendations.map(r => (
                    <li key={r.id} className="p-3 bg-gray-50 rounded border">
                      <span className="font-medium">{r.title}</span> - ₹{r.price}
                      <div className="text-xs text-gray-500 mt-1">Score: {r.match_score} | {r.type} | {r.sector}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
