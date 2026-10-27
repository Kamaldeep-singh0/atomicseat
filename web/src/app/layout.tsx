import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { StrategyProvider } from '../context/StrategyContext';
import { SocketProvider } from '../context/SocketContext';
import { Navbar } from '../components/Navbar';

export const metadata: Metadata = {
  title: 'Atomic Seat — Every seat. Exactly once.',
  description:
    'An event ticket booking system with live seat locking, deployed on serverless containers (Google Cloud Run), built to visibly demonstrate how it autoscales and stays correct when hundreds of users hit it at once.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-zinc-100 flex flex-col font-sans antialiased selection:bg-brand selection:text-black">
        <AuthProvider>
          <StrategyProvider>
            <SocketProvider>
              <Navbar />
              <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
              </main>
              <footer className="border-t border-surface-border py-6 mt-16 text-center text-xs font-mono text-zinc-400">
                <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <span className="text-zinc-300 font-semibold">Atomic Seat</span> — Every seat. Exactly once.
                  </div>
                  <div className="flex items-center space-x-4">
                    <span>Serverless Google Cloud Run</span>
                    <span>•</span>
                    <span>Socket.io + Redis</span>
                    <span>•</span>
                    <span>MongoDB Atlas</span>
                  </div>
                </div>
              </footer>
            </SocketProvider>
          </StrategyProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
