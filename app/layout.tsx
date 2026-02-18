import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
})

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
      <body className={manrope.className}>{children}</body>
    </html>
  )
}
