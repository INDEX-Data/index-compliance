import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// GET — get full conversation with messages
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    const { data, error } = await admin()
      .from('copilot_conversations')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error || !data) return Response.json({ error: 'Conversation not found' }, { status: 404 })

    return Response.json({
      id: data.id,
      title: data.title,
      clientId: data.client_id,
      messages: data.messages,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })
  } catch (err) {
    console.error('[copilot/conversations/[id] GET]', err)
    return Response.json({ error: 'Failed to load conversation' }, { status: 500 })
  }
}

// PATCH — update conversation (messages, title)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { messages, title } = body as { messages?: any[]; title?: string }

    const update: Record<string, any> = { updated_at: new Date().toISOString() }
    if (messages !== undefined) update.messages = messages
    if (title !== undefined) update.title = title

    const { error } = await admin()
      .from('copilot_conversations')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[copilot/conversations/[id] PATCH]', err)
    return Response.json({ error: 'Failed to update conversation' }, { status: 500 })
  }
}
