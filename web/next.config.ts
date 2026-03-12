import type { NextConfig } from 'next'

// API server URL: in dev defaults to localhost:3001; in production (Vercel) set
// INTERNAL_API_URL to your Railway deployment URL (e.g. https://xxx.railway.app)
// Automatically prepend https:// if the user forgot it
let API_URL = process.env.INTERNAL_API_URL ?? 'http://localhost:3001'
if (API_URL && !API_URL.startsWith('http://') && !API_URL.startsWith('https://')) {
  API_URL = `https://${API_URL}`
}

const nextConfig: NextConfig = {
  // Proxy /api/* → Express API server (avoids CORS in browser)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
