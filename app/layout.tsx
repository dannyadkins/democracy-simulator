import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Power & AI Simulator',
  description: 'Watch AI agents compete for power, game systems, and optimize outcomes',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
