import nodemailer from "nodemailer";
import { Resend } from "resend";

// Two ways to send, picked by which secrets are set:
//  1. Gmail (GMAIL_USER + GMAIL_APP_PASSWORD): works today with no domain. Fine while orders are few.
//  2. Resend (RESEND_API_KEY [+ RESEND_FROM_EMAIL]): needs a verified sending domain to reach customers.
//     Resend's shared testing domain can only send to the account owner's own address.
const DEFAULT_FROM_EMAIL = "onboarding@resend.dev";
const SHOP_NAME = "Charo 3D";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;
  if (gmailUser && gmailPassword) {
    const transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPassword },
    });
    await transport.sendMail({
      from: `"${SHOP_NAME}" <${gmailUser}>`,
      replyTo: gmailUser,
      to,
      subject,
      html,
    });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("No email sender is configured (GMAIL_* or RESEND_API_KEY)");
  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM_EMAIL;
  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    replyTo: process.env.REPLY_TO_EMAIL || undefined,
  });
  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
}
