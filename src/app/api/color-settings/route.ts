import { NextResponse } from "next/server";
import { getColorSettings } from "@/lib/colorSettingsAdmin";

// Public, read-only -- the order form needs this (unauthenticated visitors included) to know
// which colors to show and at what price. Nothing sensitive in here, just enabled/priceYen per
// color, so no admin check and no firestore.rules change needed (this route reads via the Admin
// SDK, not a client-side Firestore read).
export async function GET() {
  const settings = await getColorSettings();
  return NextResponse.json(settings, { headers: { "Cache-Control": "no-store" } });
}
