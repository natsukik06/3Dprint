import { NextResponse, type NextRequest } from "next/server";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getColorSettings, saveColorSettings } from "@/lib/colorSettingsAdmin";
import type { ColorSettingPatch, PriceYenBySize } from "@/lib/colorSettings";
import { MAGIC_COLOR_OPTIONS, SIZE_OPTIONS, type MagicColor } from "@/types/order";

export async function GET(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }
  const settings = await getColorSettings();
  return NextResponse.json(settings, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }

  const updates: Partial<Record<MagicColor, ColorSettingPatch>> = {};
  for (const color of MAGIC_COLOR_OPTIONS) {
    const raw = (body as Record<string, unknown>)[color];
    if (!raw || typeof raw !== "object") continue;
    const { enabled, priceYenBySize, label, imageUrl, previewPrompt } = raw as {
      enabled?: unknown;
      priceYenBySize?: unknown;
      label?: unknown;
      imageUrl?: unknown;
      previewPrompt?: unknown;
    };
    const update: ColorSettingPatch = {};
    if (typeof enabled === "boolean") update.enabled = enabled;
    if (typeof label === "string") update.label = label;
    if (typeof imageUrl === "string") update.imageUrl = imageUrl;
    if (typeof previewPrompt === "string") update.previewPrompt = previewPrompt;
    if (priceYenBySize && typeof priceYenBySize === "object") {
      const prices: Partial<PriceYenBySize> = {};
      for (const size of SIZE_OPTIONS) {
        const value = (priceYenBySize as Record<string, unknown>)[size];
        if (typeof value === "number") prices[size] = value;
      }
      if (Object.keys(prices).length > 0) update.priceYenBySize = prices;
    }
    updates[color] = update;
  }

  await saveColorSettings(updates);
  const settings = await getColorSettings();
  return NextResponse.json(settings);
}
