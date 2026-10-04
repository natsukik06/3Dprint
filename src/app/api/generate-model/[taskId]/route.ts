import { NextResponse, type NextRequest } from "next/server";
import {
  getHostedModelUrl,
  getHostedRenderedImageUrl,
  uploadGeneratedModel,
  uploadRenderedImage,
} from "@/lib/storageServer";
import { refundFailedGeneration } from "@/lib/generationHolds";
import { getTripoTaskStatus } from "@/lib/tripo";

async function resolveHostedRenderedImageUrl(
  taskId: string,
  tripoRenderedImageUrl: string | undefined
): Promise<string | undefined> {
  const existing = await getHostedRenderedImageUrl(taskId);
  if (existing) return existing;
  if (!tripoRenderedImageUrl) return undefined;

  try {
    const res = await fetch(tripoRenderedImageUrl);
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    return await uploadRenderedImage(
      buffer,
      taskId,
      res.headers.get("content-type") ?? "image/webp"
    );
  } catch (error) {
    // Best-effort -- Tripo's own signed URL still works right now (it just expires
    // eventually), so a failure here shouldn't block the customer from seeing their model.
    console.error("re-hosting rendered image failed", error);
    return tripoRenderedImageUrl;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    const status = await getTripoTaskStatus(taskId);

    if (status.status !== "success") {
      // Tripo does not bill failed/cancelled tasks -- hand the customer's credit back (once).
      if (status.status === "failed" || status.status === "banned" || status.status === "cancelled") {
        await refundFailedGeneration(taskId).catch((error) =>
          console.error(`refundFailedGeneration failed for ${taskId}`, error)
        );
      }
      return NextResponse.json(status);
    }

    // Tripo's renderedImageUrl is a signed URL that eventually expires -- re-host it to
    // permanent storage the same way the model itself already is, so a gallery thumbnail
    // saved from this response doesn't silently break later (see PreviewPanel's gallery row).
    const renderedImageUrl = await resolveHostedRenderedImageUrl(
      taskId,
      status.renderedImageUrl
    );

    const existingUrl = await getHostedModelUrl(taskId);
    if (existingUrl) {
      return NextResponse.json({ ...status, modelUrl: existingUrl, renderedImageUrl });
    }

    const modelRes = await fetch(status.modelUrl);
    if (!modelRes.ok) {
      throw new Error(`Failed to download generated model: ${modelRes.status}`);
    }
    const modelBuffer = Buffer.from(await modelRes.arrayBuffer());
    const hostedModelUrl = await uploadGeneratedModel(modelBuffer, taskId);

    return NextResponse.json({ ...status, modelUrl: hostedModelUrl, renderedImageUrl });
  } catch (error) {
    console.error("task status check failed", error);
    return NextResponse.json(
      { error: "ステータス取得に失敗しました" },
      { status: 502 }
    );
  }
}
