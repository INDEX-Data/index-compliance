import { redirect } from 'next/navigation'

// /setup is no longer used — client onboarding happens via /clients
export default function SetupPage() {
  redirect('/clients')
}
