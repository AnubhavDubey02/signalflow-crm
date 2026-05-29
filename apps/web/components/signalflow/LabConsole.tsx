'use client';

import React, { useState } from 'react';

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
  const [phone, setPhone] = useState('+919876543210');
  const [rawChat, setRawChat] = useState('Agent: Looking for a rental?\nLead: 1bhk in 52 under 25k');
  
  const [status, setStatus] = useState<'IDLE' | 'ANALYZING' | 'REVIEW' | 'SYNCING' | 'DONE'>('IDLE');
  const [intelligence, setIntelligence] = useState<any>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setStatus('ANALYZING');
    setError(null);
    try {
      const chatPayload = parseRawWhatsAppToPayload(rawChat);
      const res = await fetch('/api/signalflow/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer STUB_TOKEN' },
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
      const res = await fetch('/api/signalflow/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer STUB_TOKEN' },
        body: JSON.stringify({ whatsappPhone: phone, intelligenceData: intelligence })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to sync');
      
      setLeadId(json.leadId);
      
      // Immediately fetch recommendations
      const recRes = await fetch(`/api/signalflow/recommendations?lead_id=${json.leadId}`, {
        headers: { 'Authorization': 'Bearer STUB_TOKEN' }
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
  );
}
