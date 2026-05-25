'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = 'http://localhost:8000';

export default function ReviewPage({ params }) {
  const { sessionId } = params;
  const router = useRouter();
  const [data, setData] = useState(null);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/api/knowledge/${sessionId}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setError('Failed to load knowledge'));
  }, [sessionId]);

  const exportData = async (format) => {
    setExporting(format);
    try {
      const res = await fetch(`${API}/api/sessions/${sessionId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `convera_${sessionId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(`Failed to export ${format.toUpperCase()}`);
    } finally {
      setExporting('');
    }
  };

  if (!data) return (
    <div className="flex items-center justify-center min-h-[calc(100vh-65px)]">
      <div className="animate-spin w-8 h-8 border-2 border-[#e94560] border-t-transparent rounded-full" />
    </div>
  );

  const { knowledge, summary } = data;

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Knowledge Review</h1>
          <p className="text-white/40 text-sm">Session: {sessionId.slice(0, 8)}...</p>
        </div>
        <button
          onClick={() => router.push(`/chat/${sessionId}`)}
          className="bg-gradient-to-r from-[#e94560] to-[#0f3460] text-white px-6 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity"
        >
          Chat with AI
        </button>
      </div>

      {/* Export Buttons */}
      <div className="flex gap-3 mb-8">
        <p className="text-white/50 text-sm self-center">Export as:</p>
        {['pdf', 'csv', 'json'].map(fmt => (
          <button
            key={fmt}
            onClick={() => exportData(fmt)}
            disabled={!!exporting}
            className="uppercase text-xs font-semibold px-4 py-2 rounded-lg border border-white/20 text-white/70 hover:border-white/40 hover:text-white transition-colors disabled:opacity-50"
          >
            {exporting === fmt ? 'Downloading...' : fmt}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm mb-6">{error}</div>}

      {/* Summary */}
      {summary && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="text-white font-semibold text-lg mb-4">AI-Generated Summary</h2>
          <div className="prose prose-invert max-w-none">
            {summary.split('\n').map((line, i) => (
              <p key={i} className={`${line.startsWith('##') ? 'text-white font-semibold text-base mt-4 mb-1' : 'text-white/70 text-sm leading-relaxed'}`}>
                {line.replace(/^##\s*/, '')}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Knowledge Cards */}
      <div className="grid grid-cols-2 gap-4">
        {knowledge.skills?.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="text-white/50 text-xs uppercase tracking-wider mb-3">Skills & Technologies</h3>
            <div className="flex flex-wrap gap-2">
              {knowledge.skills.map(s => (
                <span key={s} className="text-sm bg-blue-500/10 border border-blue-500/20 text-blue-300 px-3 py-1 rounded-full">{s}</span>
              ))}
            </div>
          </div>
        )}

        {knowledge.experience && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="text-white/50 text-xs uppercase tracking-wider mb-3">Experience</h3>
            <p className="text-white text-2xl font-bold">{knowledge.experience}</p>
          </div>
        )}

        {knowledge.entities?.ORG?.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="text-white/50 text-xs uppercase tracking-wider mb-3">Organizations</h3>
            <div className="space-y-1">
              {knowledge.entities.ORG.map(o => (
                <p key={o} className="text-white/80 text-sm">{o}</p>
              ))}
            </div>
          </div>
        )}

        {knowledge.topics?.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="text-white/50 text-xs uppercase tracking-wider mb-3">Key Topics</h3>
            <div className="flex flex-wrap gap-1">
              {knowledge.topics.slice(0, 12).map(t => (
                <span key={t} className="text-xs bg-white/5 text-white/50 px-2 py-1 rounded-full">{t}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
