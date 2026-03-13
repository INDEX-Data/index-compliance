/**
 * Email service — powered by Resend.
 *
 * Required env vars:
 *   RESEND_API_KEY   — your Resend API key (re_xxxx…)
 *   EMAIL_FROM       — verified sender address, e.g. "INDEX <noreply@yourdomain.com>"
 *                      defaults to "INDEX <onboarding@resend.dev>" (Resend sandbox, dev only)
 */

import { Resend } from "resend";

let resend: Resend | null = null;

export function initEmail(): void {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[EMAIL] RESEND_API_KEY not set — invite emails will be skipped.");
    return;
  }
  resend = new Resend(key);
  console.log("[EMAIL] Resend client initialised.");
}

// ── Team invite ────────────────────────────────────────────────────────────

export interface TeamInviteEmailOptions {
  to: string;
  inviteLink: string;
  expiresAt: Date;
  senderName?: string; // e.g. "Michael" — shown in email body if provided
}

export async function sendTeamInviteEmail(opts: TeamInviteEmailOptions): Promise<void> {
  if (!resend) return; // silently skip when email is unconfigured

  const from =
    process.env.EMAIL_FROM ?? "INDEX <onboarding@resend.dev>";

  const expiryStr = opts.expiresAt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const html = buildTeamInviteHtml({
    inviteLink: opts.inviteLink,
    expiryStr,
    senderName: opts.senderName,
  });

  await resend.emails.send({
    from,
    to: opts.to,
    subject: "You've been invited to join INDEX",
    html,
  });
}

// ── HTML template ─────────────────────────────────────────────────────────

function buildTeamInviteHtml(opts: {
  inviteLink: string;
  expiryStr: string;
  senderName?: string;
}): string {
  const { inviteLink, expiryStr, senderName } = opts;
  const senderLine = senderName
    ? `<strong>${escHtml(senderName)}</strong> has invited you`
    : "You've been invited";

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been invited to INDEX</title>
  <style>
    body { margin: 0; padding: 0; background: #F7F5F1; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 520px; margin: 48px auto; padding: 0 16px; }
    .card { background: #ffffff; border-radius: 16px; border: 1px solid #E9E5DD; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.07); }
    .header { background: #18181B; padding: 28px 32px; }
    .logo { display: flex; align-items: center; gap: 10px; }
    .logo-mark { width: 36px; height: 36px; background: #18181B; border: 2px solid #D4A843; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; }
    .logo-text { color: #F7F5F1; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
    .body { padding: 36px 32px; }
    .icon-circle { width: 56px; height: 56px; border-radius: 50%; background: #F0F9FF; border: 1px solid #BAE6FD; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 24px; }
    h1 { margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #18181B; text-align: center; }
    .subtitle { margin: 0 0 28px; font-size: 15px; color: #6B7280; text-align: center; line-height: 1.5; }
    .cta-btn { display: block; background: #18181B; color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 600; text-align: center; padding: 14px 24px; border-radius: 12px; margin: 0 0 28px; }
    .cta-btn:hover { background: #27272A; }
    .divider { border: none; border-top: 1px solid #E9E5DD; margin: 0 0 20px; }
    .link-label { font-size: 12px; color: #9CA3AF; margin: 0 0 6px; }
    .link-box { background: #F7F5F1; border: 1px solid #E9E5DD; border-radius: 8px; padding: 10px 14px; font-size: 12px; font-family: 'SF Mono', 'Fira Code', monospace; color: #374151; word-break: break-all; }
    .expiry { margin: 16px 0 0; font-size: 12px; color: #9CA3AF; text-align: center; }
    .footer { padding: 20px 32px; background: #F7F5F1; border-top: 1px solid #E9E5DD; text-align: center; }
    .footer p { margin: 0; font-size: 12px; color: #9CA3AF; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">

      <!-- Header -->
      <div class="header">
        <div class="logo">
          <div class="logo-mark">
            <span style="color:#D4A843;font-size:11px;font-weight:900;letter-spacing:0.05em;">IX</span>
          </div>
          <span class="logo-text">INDEX</span>
        </div>
      </div>

      <!-- Body -->
      <div class="body">
        <div class="icon-circle">👥</div>

        <h1>You're invited to INDEX</h1>
        <p class="subtitle">
          ${senderLine} to join their team on INDEX —
          the compliance assessment platform for Microsoft 365.
          Accept below to get read &amp; write access to their clients and assessments.
        </p>

        <a href="${escHtml(inviteLink)}" class="cta-btn">Accept Invite &rarr;</a>

        <hr class="divider" />

        <p class="link-label">Or copy this link into your browser:</p>
        <div class="link-box">${escHtml(inviteLink)}</div>

        <p class="expiry">This invite expires on <strong>${escHtml(expiryStr)}</strong>.</p>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p>You received this because someone invited you to INDEX.<br />If you weren't expecting this, you can safely ignore it.</p>
      </div>

    </div>
  </div>
</body>
</html>`;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
