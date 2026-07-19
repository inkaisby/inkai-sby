import { SITE_URL } from "@/lib/site";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

function emailFrom() {
  return (
    process.env.EMAIL_FROM ||
    "INKAI Surabaya <noreply@inkai-sby.vercel.app>"
  );
}

/**
 * Kirim email via Resend. Jika RESEND_API_KEY kosong, log saja (dev) dan return false.
 */
export async function sendAppEmail(input: SendEmailInput): Promise<boolean> {
  const to = input.to.trim().toLowerCase();
  if (!to || !to.includes("@")) return false;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(`[email:skip] ${to} — ${input.subject}`);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom(),
        to,
        subject: input.subject,
        html: input.html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[email:fail]", res.status, body);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email:error]", error);
    return false;
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${SITE_URL}/reset-password?token=${token}`;
  return sendAppEmail({
    to: email,
    subject: "Reset Password — INKAI Surabaya",
    html: `<p>Anda meminta reset password INKAI Surabaya.</p><p><a href="${resetUrl}">Reset password di sini</a></p><p>Link berlaku 1 jam. Abaikan jika bukan Anda.</p>`,
  });
}

export async function sendNotificationEmail(opts: {
  to: string;
  title: string;
  content: string;
}) {
  const dashboardUrl = `${SITE_URL}/dashboard`;
  return sendAppEmail({
    to: opts.to,
    subject: `${opts.title} — INKAI Surabaya`,
    html: `
      <p><strong>${escapeHtml(opts.title)}</strong></p>
      <p>${escapeHtml(opts.content)}</p>
      <p><a href="${dashboardUrl}">Buka dashboard INKAI Surabaya</a></p>
      <p style="color:#666;font-size:12px;">Email otomatis. Balas tidak dipantau.</p>
    `,
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
