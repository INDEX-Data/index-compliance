import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Atlas — Compliance Dashboard',
  description: 'Microsoft 365 Compliance Assessment Platform',
}

// Applied before paint to avoid a flash. Light-first: the default (no saved
// preference) is light. 'dark' is explicit; 'auto' follows time of day
// (dark 19:00–07:00) only when the user opts into it.
const THEME_SCRIPT = `(function(){try{
  var t=localStorage.getItem('atlas-theme');
  var h=new Date().getHours();
  var dark = t==='dark' || (t==='auto' && (h>=19||h<7));
  document.documentElement.classList.toggle('dark', dark);
}catch(e){}})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-sans bg-canvas text-ink antialiased">{children}</body>
    </html>
  )
}
