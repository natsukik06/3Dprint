import { NextResponse } from "next/server";
import { ADMIN_EMAIL } from "@/lib/admin";
import { sendEmail } from "@/lib/email";
import { adminDb } from "@/lib/firebaseAdmin";
import { getTripoBalance, type TripoBalance } from "@/lib/tripo";

// One 3D model costs roughly 20-40 Tripo credits (¥30-60). Below BLOCK the shop can't safely start
// another one, so new generations are paused with a friendly message instead of failing after the
// customer already waited. Below WARN the owner gets an email (at most once a day) to top up.
export const TRIPO_BLOCK_BELOW_CREDITS = 60;
export const TRIPO_WARN_BELOW_CREDITS = 500;

const CACHE_MS = 60_000;
const ALERT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const ALERT_DOC = adminDb.collection("config").doc("tripoAlert");

let cached: { at: number; balance: TripoBalance } | null = null;

export async function getCachedTripoBalance(force = false): Promise<TripoBalance> {
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.balance;
  const balance = await getTripoBalance();
  cached = { at: Date.now(), balance };
  return balance;
}

async function notifyLowBalanceOnce(balance: TripoBalance): Promise<void> {
  const snap = await ALERT_DOC.get();
  const last = (snap.data()?.lastNotifiedAt as number | undefined) ?? 0;
  if (Date.now() - last < ALERT_INTERVAL_MS) return;
  // Claim the slot first so concurrent requests don't each send a mail.
  await ALERT_DOC.set({ lastNotifiedAt: Date.now() }, { merge: true });
  const blocked = balance.available < TRIPO_BLOCK_BELOW_CREDITS;
  try {
    await sendMail(balance, blocked);
  } catch (error) {
    // Don't burn the day's alert slot on a failed send (e.g. Resend not configured yet).
    await ALERT_DOC.set({ lastNotifiedAt: last }, { merge: true });
    throw error;
  }
}

async function sendMail(balance: TripoBalance, blocked: boolean): Promise<void> {
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: blocked
      ? "【Charo 3D】Tripoの残高がなく、3Dモデル生成を停止中です"
      : "【Charo 3D】Tripoの残高が少なくなっています",
    html: `<p>Tripo の利用可能クレジット: <strong>${balance.available}</strong>（約${Math.floor(balance.available / 30)}体分）</p>
<p>${blocked ? "残高不足のため、お客様の3Dモデル生成を一時停止しています。" : "このままだと3Dモデル生成が止まります。"}</p>
<p><a href="https://platform.tripo3d.ai/">https://platform.tripo3d.ai/</a> でクレジットを追加してください。</p>`,
  });
}

/**
 * Call at the top of any route that starts (or leads into) a paid Tripo task. Returns a 503
 * response to send back when the shop is out of Tripo credits, or null to carry on. A failed
 * balance lookup never blocks customers (null) -- the later Tripo call has its own error handling.
 */
export async function guardTripoCapacity(): Promise<NextResponse | null> {
  let balance: TripoBalance;
  try {
    balance = await getCachedTripoBalance();
  } catch (error) {
    console.error("tripo balance check failed", error);
    return null;
  }

  if (balance.available < TRIPO_WARN_BELOW_CREDITS) {
    notifyLowBalanceOnce(balance).catch((error) =>
      console.error("tripo low-balance alert failed", error)
    );
  }
  if (balance.available < TRIPO_BLOCK_BELOW_CREDITS) {
    return NextResponse.json(
      {
        error:
          "ただいま3Dモデルの生成が混み合っているため、一時的にお受けできません。しばらくしてからもう一度お試しください。",
      },
      { status: 503 }
    );
  }
  return null;
}
