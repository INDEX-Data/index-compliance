import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // No more rewrites — all data goes through Supabase client directly.
  // Edge Functions are called via supabase.functions.invoke() (same origin).
}

export default nextConfig
