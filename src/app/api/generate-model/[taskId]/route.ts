import { NextResponse, type NextRequest } from "next/server";
import { getHostedModelUrl, uploadGeneratedModel } from "@/lib/orders";
import { getTripoTaskStatus } from "@/lib/tripo";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;

  try {
    const status = await getTripoTaskStatus(taskId);

    if (status.status !== "success") {
      return NextResponse.json(status);
    }

    const existingUrl = await getHostedModelUrl(taskId);
    if (existingUrl) {
      return NextResponse.json({ ...status, modelUrl: existingUrl });
    }

    const modelRes = await fetch(status.modelUrl);
    if (!modelRes.ok) {
      throw new Error(`Failed to download generated model: ${modelRes.status}`);
    }
    const modelBuffer = Buffer.from(await modelRes.arrayBuffer());
    const hostedModelUrl = await uploadGeneratedModel(modelBuffer, taskId);

    return NextResponse.json({ ...status, modelUrl: hostedModelUrl });
  } catch (error) {
    console.error("task status check failed", error);
    return NextResponse.json(
      { error: "ステータス取得に失敗しました" },
      { status: 502 }
    );
  }
}
