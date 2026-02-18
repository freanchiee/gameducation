import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VoiceIQ – AI Oral Assessment Platform',
  description:
    'AI-powered oral assessments for MYP and IB students. Replace written tests with Socratic dialogue that makes AI-assisted cheating structurally impossible.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  )
}
