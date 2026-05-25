// QuestionCard component — displays the current AI question
export default function QuestionCard({ question, isProcessing }) {
  return (
    <div className="bg-gradient-to-br from-[#16213e] to-[#0f3460] rounded-2xl p-6 border border-white/10">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-[#e94560]/20 flex items-center justify-center text-xs">
          AI
        </div>
        <span className="text-white/50 text-xs">Convera is asking</span>
      </div>
      <p className="text-white text-lg font-medium leading-relaxed">
        {isProcessing ? (
          <span className="flex items-center gap-2 text-white/60">
            <span className="animate-spin w-4 h-4 border-2 border-white/40 border-t-white/80 rounded-full" />
            Processing...
          </span>
        ) : (
          question
        )}
      </p>
    </div>
  );
}
