import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import {
  getCachedTripoBalance,
  TRIPO_BLOCK_BELOW_CREDITS,
  TRIPO_WARN_BELOW_CREDITS,
} from "@/lib/tripoCapacity";

export async function GET(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }
  try {
    const balance = await getCachedTripoBalance(true);
    return NextResponse.json(
      { ...balance, blockBelow: TRIPO_BLOCK_BELOW_CREDITS, warnBelow: TRIPO_WARN_BELOW_CREDITS },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("tripo balance lookup failed", error);
    return NextResponse.json({ error: "Tripoの残高を取得できませんでした" }, { status: 502 });
  }
}
