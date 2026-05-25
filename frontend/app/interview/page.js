'use client';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API = 'http://localhost:8000';

function getSupportedMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

// --- AI Voice (Microsoft Jenny Neural TTS via backend) ---
let currentAudio = null;

async function speakText(text, onStart, onEnd) {
  // Stop any currently playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  try {
    if (onStart) onStart();
    const res = await fetch('http://localhost:8000/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error('TTS request failed');

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      if (onEnd) onEnd();
    };
    audio.onerror = () => {
      currentAudio = null;
      if (onEnd) onEnd();
    };
    await audio.play();
  } catch (e) {
    console.warn('TTS failed, falling back to browser voice:', e);
    // Fallback to browser voice if backend TTS fails
    if (window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.92;
      if (onStart) utterance.onstart = onStart;
      if (onEnd) utterance.onend = onEnd;
      window.speechSynthesis.speak(utterance);
    } else {
      if (onEnd) onEnd();
    }
  }
}

function stopSpeakingAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

function InterviewContent() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get('session');
  const personName = params.get('name') || 'You';

  const [session, setSession] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [aiVoiceEnabled, setAiVoiceEnabled] = useState(true);
  const [knowledge, setKnowledge] = useState({});
  const [textInput, setTextInput] = useState('');
  const [inputMode, setInputMode] = useState('voice');
  const [exchangeCount, setExchangeCount] = useState(0);
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const conversationEndRef = useRef(null);

  // Speak whenever the question changes and voice is enabled
  useEffect(() => {
    if (!currentQuestion || !aiVoiceEnabled) return;
    speakText(
      currentQuestion,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false),
    );
    return () => window.speechSynthesis?.cancel();
  }, [currentQuestion, aiVoiceEnabled]);

  // Stop speaking when user starts recording
  const stopSpeaking = useCallback(() => {
    stopSpeakingAudio();
    setIsSpeaking(false);
  }, []);

  useEffect(() => {
    if (!sessionId) { router.push('/'); return; }
    fetch(`${API}/api/sessions/${sessionId}`)
      .then(async r => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      })
      .then(data => {
        setSession(data);
        const lastAssistant = [...(data.conversation || [])].reverse().find(m => m.role === 'assistant');
        if (lastAssistant) setCurrentQuestion(lastAssistant.content);
        setKnowledge(data.knowledge || {});
        setExchangeCount((data.conversation || []).filter(m => m.role === 'user').length);
      })
      .catch(e => setError('Failed to load session. Please go back and start again.'));
  }, [sessionId, router]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session]);

  const startRecording = useCallback(async () => {
    setError('');
    stopSpeaking(); // stop AI voice when user starts answering
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        if (blob.size < 100) {
          setError('Recording was too short. Please hold the button longer and speak clearly.');
          setIsProcessing(false);
          return;
        }
        await processAudio(blob, mimeType);
      };
      mediaRecorder.start(250);
      setIsRecording(true);
    } catch (e) {
      if (e.name === 'NotAllowedError') {
        setError('Microphone access denied. Switch to "Type Answer" mode or allow mic in browser settings.');
      } else {
        setError(`Microphone error: ${e.message}. Try "Type Answer" mode instead.`);
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  }, []);

  const processAudio = async (blob, mimeType) => {
    const ext = (mimeType || 'audio/webm').split('/')[1]?.split(';')[0] || 'webm';
    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('audio', blob, `recording.${ext}`);

    try {
      const res = await fetch(`${API}/api/voice/transcribe`, { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) {
        // Show the actual error from the backend
        setError(`Error: ${data.detail || 'Unknown error. Check backend terminal.'}`);
        setIsProcessing(false);
        return;
      }

      if (data.transcript) {
        setTranscript(data.transcript);
        setError('');
      }

      if (data.question) {
        setCurrentQuestion(data.question);
        setKnowledge(data.knowledge_extracted || {});
        if (data.transcript) {
          setExchangeCount(c => c + 1);
          setSession(prev => prev ? {
            ...prev,
            conversation: [
              ...(prev.conversation || []),
              { role: 'user', content: data.transcript },
              { role: 'assistant', content: data.question },
            ],
          } : prev);
        }
      }
    } catch (e) {
      setError('Could not reach the backend. Make sure it is running on port 8000.');
    } finally {
      setIsProcessing(false);
    }
  };

  const submitText = async () => {
    if (!textInput.trim()) return;
    setIsProcessing(true);
    setError('');
    const text = textInput;
    setTextInput('');
    try {
      const res = await fetch(`${API}/api/text/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, text }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(`Error: ${data.detail || 'Failed to submit answer.'}`);
        setIsProcessing(false);
        return;
      }

      setCurrentQuestion(data.question);
      setKnowledge(data.knowledge_extracted || {});
      setExchangeCount(c => c + 1);
      setSession(prev => prev ? {
        ...prev,
        conversation: [
          ...(prev.conversation || []),
          { role: 'user', content: text },
          { role: 'assistant', content: data.question },
        ],
      } : prev);
    } catch (e) {
      setError('Could not reach the backend. Make sure it is running on port 8000.');
    } finally {
      setIsProcessing(false);
    }
  };

  const finalizeInterview = async () => {
    setIsProcessing(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/sessions/${sessionId}/finalize`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(`Error: ${data.detail || 'Failed to finalize.'}`);
        setIsProcessing(false);
        return;
      }
      router.push(`/review/${sessionId}`);
    } catch (e) {
      setError('Could not reach the backend.');
      setIsProcessing(false);
    }
  };

  if (!session) return (
    <div className="flex items-center justify-center min-h-[calc(100vh-65px)] flex-col gap-4">
      <div className="animate-spin w-8 h-8 border-2 border-[#e94560] border-t-transparent rounded-full" />
      <p className="text-white/40 text-sm">Loading session...</p>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-65px)] flex">
      {/* Main Interview Panel */}
      <div className="flex-1 flex flex-col p-6 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-white font-semibold text-lg">Interviewing {personName}</h2>
            <p className="text-white/40 text-sm">{exchangeCount} exchanges completed</p>
          </div>
          {exchangeCount >= 3 && (
            <button
              onClick={finalizeInterview}
              disabled={isProcessing}
              className="bg-[#e94560]/20 border border-[#e94560]/40 text-[#e94560] px-4 py-2 rounded-xl text-sm hover:bg-[#e94560]/30 transition-colors disabled:opacity-50"
            >
              Finish Interview
            </button>
          )}
        </div>

        {/* Question Display */}
        <div className="bg-gradient-to-br from-[#16213e] to-[#0f3460] rounded-2xl p-6 mb-6 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#e94560]/20 flex items-center justify-center text-xs text-white">AI</div>
              <span className="text-white/50 text-xs">Convera is asking</span>
              {isSpeaking && (
                <span className="flex items-center gap-1 text-[#e94560] text-xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#e94560] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#e94560]" />
                  </span>
                  Speaking...
                </span>
              )}
            </div>
            {/* AI Voice Toggle */}
            <button
              onClick={() => {
                const next = !aiVoiceEnabled;
                setAiVoiceEnabled(next);
                if (!next) { stopSpeakingAudio(); setIsSpeaking(false); }
              }}
              title={aiVoiceEnabled ? 'Mute AI voice' : 'Unmute AI voice'}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-colors ${
                aiVoiceEnabled
                  ? 'bg-[#e94560]/20 text-[#e94560] border border-[#e94560]/30'
                  : 'bg-white/5 text-white/30 border border-white/10'
              }`}
            >
              {aiVoiceEnabled ? '🔊 Voice On' : '🔇 Voice Off'}
            </button>
          </div>
          <p className="text-white text-lg font-medium leading-relaxed">
            {isProcessing ? (
              <span className="flex items-center gap-2 text-white/60">
                <span className="animate-spin w-4 h-4 border-2 border-white/40 border-t-white/80 rounded-full inline-block" />
                Processing your answer...
              </span>
            ) : currentQuestion || 'Loading question...'}
          </p>
          {/* Replay button */}
          {!isProcessing && currentQuestion && aiVoiceEnabled && !isSpeaking && (
            <button
              onClick={() => speakText(currentQuestion, () => setIsSpeaking(true), () => setIsSpeaking(false))}
              className="mt-3 text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              🔁 Replay question
            </button>
          )}
        </div>

        {/* Input Mode Toggle */}
        <div className="flex gap-2 mb-4">
          {['voice', 'text'].map(mode => (
            <button
              key={mode}
              onClick={() => { setInputMode(mode); setError(''); }}
              className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${
                inputMode === mode
                  ? 'bg-[#e94560] text-white'
                  : 'bg-white/5 text-white/50 hover:text-white/70'
              }`}
            >
              {mode === 'voice' ? '🎤 Voice Input' : '⌨️ Type Answer'}
            </button>
          ))}
        </div>

        {/* Voice Recording */}
        {inputMode === 'voice' && (
          <div className="flex flex-col items-center gap-6 py-6">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              className={`relative w-24 h-24 rounded-full flex items-center justify-center text-3xl transition-all disabled:opacity-50 ${
                isRecording
                  ? 'bg-[#e94560] scale-110 shadow-lg shadow-[#e94560]/40'
                  : 'bg-white/10 hover:bg-white/20 hover:scale-105'
              }`}
            >
              {isRecording ? '⏹' : '🎤'}
            </button>

            {isRecording && (
              <div className="flex items-end gap-1 h-8">
                {[...Array(7)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-[#e94560] rounded-full wave-bar"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            )}

            <p className="text-white/40 text-sm text-center">
              {isProcessing
                ? 'Transcribing and generating next question...'
                : isRecording
                ? '🔴 Recording — click to stop'
                : 'Click the mic to record your answer'}
            </p>

            {transcript && !isProcessing && (
              <div className="w-full bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-white/50 text-xs mb-1">Your last answer:</p>
                <p className="text-white/80 text-sm">{transcript}</p>
              </div>
            )}
          </div>
        )}

        {/* Text Input */}
        {inputMode === 'text' && (
          <div className="flex flex-col gap-3">
            <textarea
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) submitText(); }}
              placeholder="Type your answer here... (Ctrl+Enter to submit)"
              rows={5}
              disabled={isProcessing}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#e94560]/50 resize-none transition-colors disabled:opacity-50"
            />
            <button
              onClick={submitText}
              disabled={isProcessing || !textInput.trim()}
              className="self-end bg-[#e94560] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              {isProcessing ? (
                <><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Submitting...</>
              ) : 'Submit Answer'}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm space-y-1">
            <p className="font-medium">Something went wrong</p>
            <p className="text-red-300/80">{error}</p>
            {inputMode === 'voice' && (
              <button
                onClick={() => { setInputMode('text'); setError(''); }}
                className="text-xs text-white/60 underline mt-1"
              >
                Switch to text mode instead
              </button>
            )}
          </div>
        )}
      </div>

      {/* Side Panel */}
      <div className="w-80 border-l border-white/10 p-4 overflow-y-auto hidden lg:block">
        <div className="mb-6">
          <h3 className="text-white/50 text-xs uppercase tracking-wider mb-3">Conversation</h3>
          <div className="space-y-2">
            {(session.conversation || []).map((msg, i) => (
              <div key={i} className={`text-xs rounded-lg p-2 ${
                msg.role === 'assistant'
                  ? 'bg-[#0f3460]/50 text-white/70'
                  : 'bg-[#e94560]/10 text-white/80'
              }`}>
                <span className="font-medium block mb-0.5">
                  {msg.role === 'assistant' ? 'Convera AI' : personName}
                </span>
                {(msg.content || '').slice(0, 120)}{(msg.content || '').length > 120 ? '...' : ''}
              </div>
            ))}
            <div ref={conversationEndRef} />
          </div>
        </div>

        {Object.keys(knowledge).length > 0 && (
          <div>
            <h3 className="text-white/50 text-xs uppercase tracking-wider mb-3">Extracted Knowledge</h3>
            {knowledge.skills?.length > 0 && (
              <div className="mb-3">
                <p className="text-white/40 text-xs mb-1">Skills</p>
                <div className="flex flex-wrap gap-1">
                  {knowledge.skills.map(s => (
                    <span key={s} className="text-xs bg-[#0f3460]/50 text-blue-300 px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {knowledge.experience && (
              <div className="mb-3">
                <p className="text-white/40 text-xs mb-1">Experience</p>
                <p className="text-white/70 text-xs">{knowledge.experience}</p>
              </div>
            )}
            {knowledge.topics?.length > 0 && (
              <div>
                <p className="text-white/40 text-xs mb-1">Topics Detected</p>
                <div className="flex flex-wrap gap-1">
                  {knowledge.topics.slice(0, 10).map(t => (
                    <span key={t} className="text-xs bg-white/5 text-white/50 px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {exchangeCount === 0 && (
          <div className="mt-6 bg-white/3 rounded-xl p-4 text-white/30 text-xs text-center">
            Knowledge extracted from your answers will appear here
          </div>
        )}
      </div>
    </div>
  );
}

export default function InterviewPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[calc(100vh-65px)] flex-col gap-3">
        <div className="animate-spin w-8 h-8 border-2 border-[#e94560] border-t-transparent rounded-full" />
        <p className="text-white/30 text-sm">Loading...</p>
      </div>
    }>
      <InterviewContent />
    </Suspense>
  );
}
