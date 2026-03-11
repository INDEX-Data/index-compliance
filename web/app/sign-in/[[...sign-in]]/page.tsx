import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#F7F5F1] flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#141412]">
            <svg className="w-5 h-5 text-[#F7F5F1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div>
            <div className="text-[15px] font-bold text-[#141412] tracking-widest uppercase">INDEX</div>
            <div className="text-[10px] text-[#5A5A52] leading-none tracking-wide uppercase">Compliance</div>
          </div>
        </div>

        <SignIn />
      </div>
    </div>
  )
}
