import { redirect } from 'next/navigation'

// /setup is retired — connecting a Microsoft 365 environment happens via OAuth
// admin-consent on the Connect (Integrations) page.
export default function SetupPage() {
  redirect('/integrations')
}
