import LabConsole from '@/components/signalflow/LabConsole';

export default function HomePage() {
  return (
    <main style={{ padding: '40px', fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>SignalFlow QA Lab Console</h1>
          <p style={{ color: '#64748b', marginTop: '8px' }}>Test WhatsApp DOM extraction pipelines, OpenAI CRM sync mechanics, and live database matching.</p>
        </header>
        <LabConsole />
      </div>
    </main>
  );
}
