import React from 'react';
import LabConsole from '@/components/signalflow/LabConsole';

export const metadata = {
  title: 'SignalFlow Lab | Internal QA',
  description: 'QA Environment for SignalFlow Backend Pipeline'
};

export default function SignalFlowLabPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">SignalFlow Internal QA Console</h1>
          <p className="mt-2 text-sm text-gray-600">
            Validate the entire backend pipeline without the Chrome Extension. Paste a raw chat export to test the OpenAI extraction, Sync API, and Inventory Matching RPC.
          </p>
        </div>
        
        {/* Client Component handles all the state and API calls */}
        <LabConsole />
      </div>
    </div>
  );
}
