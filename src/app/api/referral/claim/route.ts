import { NextResponse, type NextRequest } from "next/server";
import { claimReferral } from "@/lib/referral";
import { verifyRequestUser } from "@/lib/verifyRequestUser";

export async function POST(request: NextRequest) {
  const user = await verifyRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const referrerUid = body?.referrerUid;
  if (typeof referrerUid !== "string" || !referrerUid) {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
  if (referrerUid === user.uid) {
    return NextResponse.json({ error: "自分自身の紹介リンクは利用できません" }, { status: 400 });
  }

  const result = await claimReferral(user.uid, referrerUid);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
