import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'INDEX — Compliance Dashboard',
  description: 'Microsoft 365 Compliance Assessment Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider afterSignOutUrl="/sign-in">
      <html lang="en" className={inter.variable}>
        <body className="font-sans bg-[#fafafa] text-[#1c1d1f] antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
