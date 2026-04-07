export default function Loading() {
  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-[#1c1917] border-t-transparent rounded-full animate-spin" />
        <span className="text-[13px] text-[#a8a29e] font-medium">Loading…</span>
      </div>
    </div>
  )
}
