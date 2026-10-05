import { NextResponse, type NextRequest } from "next/server";
import { parseSurveyAnswers, submitSurvey } from "@/lib/survey";
import { verifyRequestUser } from "@/lib/verifyRequestUser";

export async function POST(request: NextRequest) {
  const user = await verifyRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const answers = parseSurveyAnswers(body);
  if (!answers) {
    return NextResponse.json({ error: "未入力または不正な項目があります" }, { status: 400 });
  }

  const result = await submitSurvey(user.uid, user.email ?? null, answers);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
