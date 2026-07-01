'use client'

// =============================================================================
// INDEX ATLAS — Home (agent-native)
// The landing surface is the conversation, not a static dashboard. The agent
// reads the live environment and renders posture/findings/etc. as artifacts
// inline. The legacy structured views remain reachable from the nav as "full
// views" (/reports, /findings, /drift, /assess/[id]).
// =============================================================================

import { AgentConversation } from '@/components/AgentConversation'

// Workflow starters — Connect · Ask · Discover · Plan · Act · Monitor.
const STARTERS = [
  'How do I stand across my frameworks right now?',
  'What are my biggest gaps and risks?',
  'Which controls are failing, and how would I fix them?',
  'What changed since my last assessment?',
]

export default function HomePage() {
  return (
    <div className="h-full">
      <AgentConversation starters={STARTERS} emptyTitle="Ask your environment" />
    </div>
  )
}
