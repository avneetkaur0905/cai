'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API = 'http://localhost:8000';

export default function Home() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [personName, setPersonName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState('');

  const startInterview = async () => {
    if (!personName.trim()) { setError('Please enter a name'); return; }
    setLoading(true);
    setError('');
    setLoadingStep('Setting up your session...');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const res = await fetch(`${API}/api/sessions/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic || 'professional background and expertise',
          person_name: personName,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();
      if (!res.ok) {
        setError(`Server error: ${data.detail || 'Unknown error'}`);
        return;
      }
      setLoadingStep('Launching interview...');
      router.push(`/interview?session=${data.session_id}&name=${encodeURIComponent(personName)}`);
    } catch (e) {
      if (e.name === 'AbortError') {
        setError('Request timed out. The backend is taking too long — check if it is running on port 8000.');
      } else {
        setError('Could not connect to the backend. Make sure it is running on port 8000.');
      }
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const topics = [
    'Professional background & expertise',
    'Technical skills & projects',
    'Career goals & aspirations',
    'Research & academic background',
    'Startup & entrepreneurship experience',
    'Creative & design portfolio',
  ];

  return (
    <main className="min-h-[calc(100vh-65px)] flex flex-col items-center justify-center px-4 py-12">
      <div className="text-center mb-12 max-w-2xl">
        <div className="inline-flex items-center gap-2 bg-[#e94560]/10 border border-[#e94560]/30 rounded-full px-4 py-1.5 text-[#e94560] text-sm mb-6">
          AI-Powered Voice Interviews
        </div>
        <h1 className="text-5xl font-bold text-white mb-4 leading-tight">
          Build a Knowledge Base<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e94560] to-[#0f3460]">From Any Conversation</span>
        </h1>
        <p className="text-white/60 text-lg">
          Speak naturally. Our AI interviews you, extracts your knowledge, stores it in a vector database,
          and creates a personalized AI assistant that knows everything about you.
        </p>
      </div>

      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">Your Name</label>
          <input
            type="text"
            value={personName}
            onChange={e => setPersonName(e.target.value)}
            placeholder="Enter your name..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#e94560]/50 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">Interview Topic</label>
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="What should we focus on?"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#e94560]/50 transition-colors mb-3"
          />
          <div className="flex flex-wrap gap-2">
            {topics.map(t => (
              <button
                key={t}
                onClick={() => setTopic(t)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  topic === t
                    ? 'bg-[#e94560]/20 border-[#e94560]/50 text-[#e94560]'
                    : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/70'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-4 py-2">{error}</p>}

        <button
          onClick={startInterview}
          disabled={loading}
          className="w-full bg-gradient-to-r from-[#e94560] to-[#0f3460] text-white font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> {loadingStep || 'Starting...'}</>
          ) : (
            <>🎤 Start Voice Interview</>
          )}
        </button>
      </div>

      <div className="mt-16 grid grid-cols-3 gap-6 max-w-2xl text-center">
        {[
          { icon: '', title: 'Voice → Text', desc: 'Whisper STT converts your speech in real-time' },
          { icon: '', title: 'NLP Extraction', desc: 'Skills, entities, and topics extracted automatically' },
          { icon: '', title: 'Qdrant Storage', desc: 'Knowledge stored as embeddings in vector DB' },
        ].map(f => (
          <div key={f.title} className="bg-white/3 border border-white/5 rounded-xl p-5">
            <div className="text-2xl mb-2">{f.icon}</div>
            <div className="text-white font-medium text-sm mb-1">{f.title}</div>
            <div className="text-white/40 text-xs">{f.desc}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
