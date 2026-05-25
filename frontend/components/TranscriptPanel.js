// TranscriptPanel component — displays conversation history
export default function TranscriptPanel({ conversation, personName }) {
  return (
    <div className="space-y-2">
      {conversation.map((msg, i) => (
        <div
          key={i}
          className={`text-xs rounded-lg p-2 ${
            msg.role === 'assistant'
              ? 'bg-[#0f3460]/50 text-white/70'
              : 'bg-[#e94560]/10 text-white/80'
          }`}
        >
          <span className="font-medium">
            {msg.role === 'assistant' ? 'AI: ' : `${personName}: `}
          </span>
          {msg.content.slice(0, 100)}
          {msg.content.length > 100 ? '...' : ''}
        </div>
      ))}
    </div>
  );
}
