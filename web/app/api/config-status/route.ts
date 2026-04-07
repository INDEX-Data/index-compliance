import { NextResponse } from 'next/server'

export async function GET() {
  // Use INDEX_ANTHROPIC_KEY to avoid collision with Claude Code's ANTHROPIC_API_KEY env var
  const key = process.env.INDEX_ANTHROPIC_KEY
  return NextResponse.json({
    anthropicConfigured: !!key,
  })
}
