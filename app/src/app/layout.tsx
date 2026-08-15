import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AutoEdit Studio - Local GPU AI Video Automation',
  description: 'Production-grade AI Video Editor for Windows with Word-Level Whisper, Kinetic Captions, Gemini Script Generation, and NVENC Hardware Acceleration.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-slate-100 min-h-screen antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
