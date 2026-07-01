'use client'

// =============================================================================
// INDEX ATLAS — Artifact renderer
// Maps an agent-emitted artifact { kind, data } to a React component rendered
// inline in the conversation transcript. The data is plain JSON streamed from
// the server (web/lib/posture.ts); here we adapt it into each component's props.
// Add a new `kind` by adding a branch + reusing an existing presentational view.
// =============================================================================

import { PostureView, type PostureData } from '@/components/PostureView'
import type { PostureArtifactData } from '@/lib/posture'

export interface Artifact {
  kind: string
  data: unknown
}

function postureToData(d: PostureArtifactData): PostureData {
  return {
    status: d.status,
    statusTone: d.statusTone,
    score: d.score,
    scoreLabel: 'Score',
    syncedLabel: d.syncedLabel,
    summaryLine: (
      <>
        <span className="font-mono text-ink">{d.controls.toLocaleString()}</span> controls ·{' '}
        <span className="font-mono text-ink">{d.openFindings}</span> open findings · across{' '}
        <span className="text-ink">{d.frameworkNames.slice(0, 3).join(', ')}</span>
        {d.frameworkCount > 3 ? ` +${d.frameworkCount - 3}` : ''}.
      </>
    ),
    stats: [
      { label: 'Open findings', value: d.openFindings },
      { label: 'Needs review', value: d.needsReview },
      { label: 'Frameworks', value: d.frameworkCount },
    ],
    topFinding: d.topFinding
      ? { title: d.topFinding.title, controlId: d.topFinding.frameworkName }
      : undefined,
  }
}

export function ArtifactRenderer({ artifact }: { artifact: Artifact }) {
  if (artifact.kind === 'posture') {
    return (
      <div className="border border-border rounded-xl overflow-hidden bg-surface my-2">
        <PostureView data={postureToData(artifact.data as PostureArtifactData)} />
      </div>
    )
  }
  // Unknown artifact kind — render nothing rather than break the transcript.
  return null
}
