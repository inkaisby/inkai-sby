import { SITE_URL } from "@/lib/site";

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${SITE_URL}/reset-password?token=${token}`;
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.info(`[password-reset] ${email}: ${resetUrl}`);
    return false;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "INKAI Surabaya <noreply@inkai-sby.vercel.app>",
      to: email,
      subject: "Reset Password — INKAI Surabaya",
      html: `<p>Anda meminta reset password INKAI Surabaya.</p><p><a href="${resetUrl}">Reset password di sini</a></p><p>Link berlaku 1 jam. Abaikan jika bukan Anda.</p>`,
    }),
  });

  return res.ok;
}
