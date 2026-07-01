import { redirect } from 'next/navigation'

// The manual multi-tenant "clients" management page is retired. ATLAS is a
// single-environment product now — you connect your Microsoft 365 tenant via
// OAuth admin-consent on the Connect (Integrations) page, which creates the
// environment automatically. Kept as a redirect so existing links don't 404.
export default function ClientsPage() {
  redirect('/integrations')
}
