const TRIPO_API_BASE = "https://api.tripo3d.ai/v2/openapi";
const MODEL_VERSION = "v3.0-20250812";

function getApiKey(): string {
  const apiKey = process.env.TRIPO_API_KEY;
  if (!apiKey) throw new Error("TRIPO_API_KEY is not set");
  return apiKey;
}

const MAX_RETRIES = 3;
const RATE_LIMIT_CODE = 2000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Found by running 20 real photos through the pipeline: Tripo sometimes answers with an HTML error
// page (a gateway hiccup) instead of JSON, or with code 2000 ("exceeded the limit of generation")
// when too many tasks are in flight. Both used to surface as a raw JSON-parse / API error and fail
// the customer's paid generation outright. Transient failures are now retried with backoff.
//
// POST /task is retried ONLY for the explicit rate-limit answer (nothing was created in that
// case) -- retrying it after an ambiguous 5xx could create, and charge for, a duplicate task.
// Tripo's responses are consumed by property path only (data.result.pbr_model.url ...), and the
// response shape varies by task type, so this stays loosely typed like res.json() always was.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TripoJson = any;

async function tripoFetch(path: string, init: RequestInit, attempt = 0): Promise<TripoJson> {
  const res = await fetch(`${TRIPO_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      ...init.headers,
    },
  });

  const text = await res.text();
  let json: TripoJson = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Non-JSON body (e.g. an HTML gateway error page) -- handled below.
  }

  const isCreateTask = path === "/task" && init.method === "POST";
  const rateLimited = res.status === 429 || json?.code === RATE_LIMIT_CODE;
  const transient = !json ? res.status >= 500 || res.status === 429 || res.status === 0 || text.trimStart().startsWith("<") : false;
  const retryable = rateLimited || (transient && !isCreateTask);

  if (retryable && attempt < MAX_RETRIES) {
    const retryAfterSec = Number(res.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
      ? Math.min(retryAfterSec, 10) * 1000
      : 1000 * 2 ** attempt;
    await sleep(waitMs);
    return tripoFetch(path, init, attempt + 1);
  }

  if (!json) {
    throw new Error(`Tripo API returned a non-JSON response at ${path} (HTTP ${res.status})`);
  }
  if (!res.ok || json.code !== 0) {
    throw new Error(`Tripo API error at ${path}: ${JSON.stringify(json)}`);
  }
  return json;
}

export type TripoBalance = { balance: number; frozen: number; available: number };

// Credits left on the account. `frozen` is what in-flight tasks have reserved (released back if the
// task fails), so `available` is what a NEW task can actually draw on.
export async function getTripoBalance(): Promise<TripoBalance> {
  const json = await tripoFetch("/user/balance", { method: "GET" });
  const balance = Number(json.data?.balance ?? 0);
  const frozen = Number(json.data?.frozen ?? 0);
  return { balance, frozen, available: balance - frozen };
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
