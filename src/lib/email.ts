import { Resend } from "resend";

// Resend's shared testing domain works without any DNS setup but can only send to the
// account owner's own verified address. Once a real sending domain is verified in the Resend
// dashboard, set RESEND_FROM_EMAIL to an address on that domain.
const DEFAULT_FROM_EMAIL = "onboarding@resend.dev";

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  return new Resend(apiKey);
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const resend = getClient();
  const from = process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM_EMAIL;
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
}
