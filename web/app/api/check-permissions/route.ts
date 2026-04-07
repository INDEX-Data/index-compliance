import { createClient } from '@supabase/supabase-js'
import { createServerSupabase } from '@/lib/supabase'
import { decryptIfNeeded } from '@/lib/crypto'
import { checkAllPermissions } from '@/lib/permissions-check'

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const clientId = url.searchParams.get('clientId')

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Get client
    let clientQuery = admin
      .from('clients')
      .select('id, name, tenant_id, client_id, client_secret')
      .eq('user_id', user.id)

    if (clientId) {
      clientQuery = clientQuery.eq('id', clientId)
    } else {
      clientQuery = clientQuery.order('added_at', { ascending: false }).limit(1)
    }

    const { data: clientRow } = await clientQuery.single()
    if (!clientRow) {
      return Response.json({ error: 'No client found' }, { status: 404 })
    }

    const report = await checkAllPermissions(
      decryptIfNeeded(clientRow.tenant_id),
      decryptIfNeeded(clientRow.client_id),
      decryptIfNeeded(clientRow.client_secret)
    )

    return Response.json({
      clientId: clientRow.id,
      clientName: clientRow.name,
      ...report,
    })
  } catch (err) {
    console.error('[check-permissions] error:', err)
    return Response.json({ error: 'Failed to check permissions' }, { status: 500 })
  }
}
