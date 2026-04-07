import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig: NextConfig = {
  // Turbopack config (Next.js 16 default bundler)
  // Resolves .js imports → .ts source files for MCP server code in src/
  turbopack: {
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  // Webpack fallback (used with --webpack flag)
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.js'],
    }
    return config
  },
  // Silence "multiple lockfiles" warning in monorepo — point to repo root
  outputFileTracingRoot: path.join(__dirname, '..'),
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default nextConfig
