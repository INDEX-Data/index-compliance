import { redirect } from 'next/navigation'

// Reports now live at /reports (the dedicated hub). Keep this route as a
// permanent redirect so any saved links / bookmarks still resolve.
export default function HistoryRedirect() {
  redirect('/reports')
}
