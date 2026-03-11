import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  // Proxy /api/* → Express on :3001 so frontend has no CORS issues
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ]
  },
  // Silence the "workspace root" warning from having two package-lock.json files
  turbopack: {
    root: path.resolve(__dirname),
  },
}

export default nextConfig
