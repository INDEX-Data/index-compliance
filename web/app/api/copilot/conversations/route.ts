import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'

const admin = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// GET — list conversations for user
export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const clientId = url.searchParams.get('clientId')

    let query = admin()
      .from('copilot_conversations')
      .select('id, title, client_id, created_at, updated_at, messages')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (clientId) {
      query = query.eq('client_id', clientId)
    }

    const { data, error } = await query
    if (error) return Response.json({ error: error.message }, { status: 500 })

    // Return with message count (don't send full messages in list)
    const list = (data || []).map(c => ({
      id: c.id,
      title: c.title,
      clientId: c.client_id,
      messageCount: Array.isArray(c.messages) ? c.messages.length : 0,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }))

    return Response.json(list)
  } catch (err) {
    console.error('[copilot/conversations GET]', err)
    return Response.json({ error: 'Failed to load conversations' }, { status: 500 })
  }
}

// POST — create new conversation
export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const { clientId, title, messages } = body as {
      clientId?: string
      title?: string
      messages?: any[]
    }

    const { data, error } = await admin()
      .from('copilot_conversations')
      .insert({
        user_id: user.id,
        client_id: clientId || null,
        title: title || 'New conversation',
        messages: messages || [],
      })
      .select('id')
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({ id: data.id })
  } catch (err) {
    console.error('[copilot/conversations POST]', err)
    return Response.json({ error: 'Failed to create conversation' }, { status: 500 })
  }
}

// DELETE — delete a conversation
export async function DELETE(request: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    if (!id) return Response.json({ error: 'id is required' }, { status: 400 })

    const { error } = await admin()
      .from('copilot_conversations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[copilot/conversations DELETE]', err)
    return Response.json({ error: 'Failed to delete conversation' }, { status: 500 })
  }
}
