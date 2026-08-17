const TRIPO_API_BASE = "https://api.tripo3d.ai/v2/openapi";
const MODEL_VERSION = "v3.0-20250812";

function getApiKey(): string {
  const apiKey = process.env.TRIPO_API_KEY;
  if (!apiKey) throw new Error("TRIPO_API_KEY is not set");
  return apiKey;
}

async function tripoFetch(path: string, init: RequestInit) {
  const res = await fetch(`${TRIPO_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      ...init.headers,
    },
  });

  const json = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(`Tripo API error at ${path}: ${JSON.stringify(json)}`);
  }
  return json;
}

export async function uploadImageToTripo(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);

  const json = await tripoFetch("/upload", {
    method: "POST",
    body: formData,
  });
  return json.data.image_token as string;
}

export type MultiviewImageTokens = {
  front: string;
  left?: string;
  back?: string;
  right?: string;
};

export async function createMultiviewTask(
  tokens: MultiviewImageTokens
): Promise<string> {
  const files = [tokens.front, tokens.left, tokens.back, tokens.right].map(
    (token) =>
      token ? { type: "image", file_token: token } : { type: "image" }
  );

  const json = await tripoFetch("/task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "multiview_to_model",
      files,
      model_version: MODEL_VERSION,
      texture: false,
      pbr: false,
    }),
  });
  return json.data.task_id as string;
}

export type TripoTaskStatus =
  | { status: "queued" | "running"; progress: number }
  | { status: "success"; modelUrl: string; renderedImageUrl?: string }
  | { status: "failed" | "banned" | "cancelled" | "unknown"; progress?: number };

export async function getTripoTaskStatus(
  taskId: string
): Promise<TripoTaskStatus> {
  const json = await tripoFetch(`/task/${taskId}`, { method: "GET" });
  const data = json.data;

  if (data.status === "success") {
    const modelUrl: string | undefined =
      data.result?.pbr_model?.url ??
      data.result?.base_model?.url ??
      data.result?.model?.url ??
      data.output?.pbr_model ??
      data.output?.base_model ??
      data.output?.model;

    if (!modelUrl) {
      throw new Error(
        `Tripo task ${taskId} succeeded but no model URL was found in the response`
      );
    }

    return {
      status: "success",
      modelUrl,
      renderedImageUrl:
        data.result?.rendered_image?.url ?? data.output?.rendered_image,
    };
  }
  if (data.status === "queued" || data.status === "running") {
    return { status: data.status, progress: data.progress ?? 0 };
  }
  return { status: data.status ?? "unknown", progress: data.progress };
}
