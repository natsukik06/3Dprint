import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { sendEmail } from "@/lib/email";
import { buildMarketingEmail } from "@/lib/emailTemplates";
import { getSubscribedRecipients } from "@/lib/marketing";

// Sequential with a small delay between sends to stay comfortably under Resend's rate limit.
// Fine for a small subscriber list; if the list grows into the thousands this should move to a
// queued background job instead of a single request/response cycle.
const SEND_DELAY_MS = 350;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  let subject: string | undefined;
  let bodyHtml: string | undefined;
  try {
    const body = await request.json();
    subject = body?.subject;
    bodyHtml = body?.bodyHtml;
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
  if (!subject || !bodyHtml) {
    return NextResponse.json({ error: "件名と本文を入力してください" }, { status: 400 });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const recipients = await getSubscribedRecipients();

  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    const unsubscribeUrl = `${origin}/api/unsubscribe?token=${recipient.unsubscribeToken}`;
    try {
      await sendEmail({
        to: recipient.email,
        subject,
        html: buildMarketingEmail(bodyHtml, unsubscribeUrl),
      });
      sent += 1;
    } catch (error) {
      console.error(`marketing send failed for ${recipient.email}`, error);
      failed += 1;
    }
    await sleep(SEND_DELAY_MS);
  }

  return NextResponse.json({ sent, failed, total: recipients.length });
}
