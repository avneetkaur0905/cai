import './globals.css';

export const metadata = {
  title: 'Convera AI — Voice Interview System',
  description: 'AI-powered voice interview system that learns and builds personalized knowledge bases',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a1a]">
        <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#e94560] to-[#0f3460] flex items-center justify-center text-white font-bold text-sm">C</div>
            <span className="text-white font-semibold text-lg tracking-tight">Convera AI</span>
          </div>
          <div className="text-xs text-white/40">Voice-Powered Knowledge System</div>
        </nav>
        {children}
      </body>
    </html>
  );
}
