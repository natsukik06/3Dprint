import { NextResponse, type NextRequest } from "next/server";
import { runOrderProcessing } from "@/lib/processOrder";

export async function POST(request: NextRequest) {
  let orderId: string | undefined;
  try {
    const body = await request.json();
    orderId = body?.orderId;
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
  if (!orderId) {
    return NextResponse.json({ error: "orderIdが必要です" }, { status: 400 });
  }

  try {
    const result = await runOrderProcessing(orderId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("process-order failed", error);
    const message = error instanceof Error ? error.message : "注文処理に失敗しました";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
