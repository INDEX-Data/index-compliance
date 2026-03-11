import type { NextConfig } from 'next'
import path from 'path'

// API server URL: in dev defaults to localhost:3001; in production (Vercel) set
// INTERNAL_API_URL to your Railway deployment URL (e.g. https://xxx.railway.app)
const API_URL = process.env.INTERNAL_API_URL ?? 'http://localhost:3001'

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
  // Silence the "workspace root" warning from having two package-lock.json files
  turbopack: {
    root: path.resolve(__dirname),
  },
}

export default nextConfig
