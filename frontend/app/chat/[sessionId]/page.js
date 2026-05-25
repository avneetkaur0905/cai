'use client';
import { useState, useEffect, useRef } from 'react';

const API = 'http://localhost:8000';

export default function ChatPage({ params }) {
  const { sessionId } = params;
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I know everything from your interview. Ask me anything about your background, skills, or experience.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionInfo, setSessionInfo] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/api/sessions/${sessionId}`)
      .then(r => r.json())
      .then(setSessionInfo)
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message: input,
          history: messages.slice(-10),
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    'What are my top skills?',
    'Summarize my professional background',
    'What are my career goals?',
    'What projects have I worked on?',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-65px)] max-w-3xl mx-auto">
      <div className="px-6 py-4 border-b border-white/10">
        <h2 className="text-white font-semibold">
          Personalized AI — {sessionInfo?.person_name || 'Your Assistant'}
        </h2>
        <p className="text-white/40 text-xs">Powered by your interview knowledge stored in Qdrant</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-[#e94560] text-white'
                : 'bg-white/5 border border-white/10 text-white/85'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length === 1 && (
        <div className="px-6 pb-4 flex flex-wrap gap-2">
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => { setInput(s); }}
              className="text-xs bg-white/5 border border-white/10 text-white/60 px-3 py-1.5 rounded-full hover:border-white/30 hover:text-white/80 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="px-6 py-4 border-t border-white/10">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
            placeholder="Ask about your background, skills, projects..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#e94560]/50 text-sm transition-colors"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-[#e94560] text-white px-5 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-40 text-sm"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
