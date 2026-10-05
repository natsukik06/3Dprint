"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  SHOWCASE_CAPTION_MAX,
  SHOWCASE_TITLE_MAX,
  type ShowcaseCandidate,
  type ShowcaseItemAdmin,
} from "@/types/showcase";

const PHOTO_MAX_EDGE = 1600;

// Shrinks a phone photo in the browser before upload (the server also validates and resizes) so it
// stays under the serverless request-size limit.
async function downscaleImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("縮小に失敗しました"))), "image/jpeg", 0.88)
  );
}

type Api = (path: string, init?: RequestInit) => Promise<Response>;

function ItemEditor({
  item,
  api,
  onChanged,
  onError,
}: {
  item: ShowcaseItemAdmin;
  api: Api;
  onChanged: () => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [caption, setCaption] = useState(item.caption);
  const [order, setOrder] = useState(String(item.order));
  const [showOnHome, setShowOnHome] = useState(item.showOnHome);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty =
    title !== item.title ||
    caption !== item.caption ||
    Number(order) !== item.order ||
    showOnHome !== item.showOnHome;

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    onError(null);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "失敗しました");
    } finally {
      setBusy(null);
    }
  }

  async function check(res: Response) {
    if (res.ok) return;
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "失敗しました");
  }

  async function saveFields() {
    await check(
      await api(`/api/admin/showcase/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, caption, order: Number(order) || 0, showOnHome }),
      })
    );
  }

  async function publish(published: boolean) {
    if (published) await saveFields();
    await check(
      await api(`/api/admin/showcase/${item.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published }),
      })
    );
  }

  async function uploadPhoto(file: File) {
    const blob = await downscaleImage(file);
    const form = new FormData();
    form.append("file", blob, "photo.jpg");
    await check(await api(`/api/admin/showcase/${item.id}/photo`, { method: "POST", body: form }));
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
            item.published ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {item.published ? "公開中" : "下書き(まだ公開されていません)"}
        </span>
        <span className="text-xs text-slate-400">注文 {item.orderNumber ?? item.orderId} の{item.itemIndex + 1}点目</span>
      </div>

      <div className="flex gap-3">
        <div className="flex w-24 shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy !== null}
            className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-100 text-[11px] text-slate-500"
          >
            {item.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Firebase Storage URL
              <img src={item.photoUrl} alt="実物写真" className="h-full w-full object-cover" />
            ) : (
              "実物写真を追加"
            )}
            {busy === "photo" && (
              <span className="absolute inset-0 flex items-center justify-center bg-white/70">送信中</span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) run("photo", () => uploadPhoto(file));
            }}
          />
          {item.photoUrl && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                run("photo", async () =>
                  check(await api(`/api/admin/showcase/${item.id}/photo`, { method: "DELETE" }))
                )
              }
              className="text-[11px] text-slate-500 underline"
            >
              写真を外す
            </button>
          )}
          {item.customerImageUrl && (
            <div className="mt-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- Firebase Storage URL */}
              <img src={item.customerImageUrl} alt="お客様の写真" className="aspect-square w-full rounded-lg object-cover" />
              <p className="text-[10px] text-slate-400">お客様の写真(使用)</p>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <label className="block text-xs text-slate-500">
            タイトル(匿名・個人名は書かない)
            <input
              type="text"
              value={title}
              maxLength={SHOWCASE_TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例: ふわふわ茶トラのキーホルダー"
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900 outline-none focus:border-slate-500"
            />
          </label>
          <label className="block text-xs text-slate-500">
            一言(任意)
            <input
              type="text"
              value={caption}
              maxLength={SHOWCASE_CAPTION_MAX}
              onChange={(e) => setCaption(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900 outline-none focus:border-slate-500"
            />
          </label>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <label className="flex items-center gap-1">
              表示順
              <input
                type="number"
                min={0}
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                className="w-16 rounded-lg border border-slate-300 px-1.5 py-1 text-right"
              />
              <span className="text-slate-400">(小さいほど先)</span>
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={showOnHome}
                onChange={(e) => setShowOnHome(e.target.checked)}
                className="h-4 w-4 accent-slate-800"
              />
              ホームに表示
            </label>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy !== null || !title.trim()}
          onClick={() => run("publish", () => publish(true))}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy === "publish" ? "反映中..." : "反映"}
        </button>
        <button
          type="button"
          disabled={busy !== null || !dirty}
          onClick={() => run("save", saveFields)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-40"
        >
          下書き保存
        </button>
        {item.published && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run("unpublish", () => publish(false))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 disabled:opacity-40"
          >
            非公開に戻す
          </button>
        )}
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            if (window.confirm("この作成例を削除します(コピーした3Dモデル・写真も消えます。元の注文は消えません)。よろしいですか?")) {
              run("delete", async () =>
                check(await api(`/api/admin/showcase/${item.id}`, { method: "DELETE" }))
              );
            }
          }}
          className="ml-auto rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
        >
          削除
        </button>
      </div>
      <p className="text-[11px] text-slate-400">
        「反映」を押すと、いまの入力内容で公開サイトに反映されます(公開中の作成例を編集したあとも、もう一度「反映」を押してください)。「下書き保存」だけでは公開サイトは変わりません。
      </p>
    </div>
  );
}

function ShowcaseAdmin() {
  const { user } = useAuth();
  const [items, setItems] = useState<ShowcaseItemAdmin[] | null>(null);
  const [candidates, setCandidates] = useState<ShowcaseCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [useCustomer, setUseCustomer] = useState<Record<string, boolean>>({});

  const api = useCallback<Api>(
    async (path, init) => {
      if (!user) throw new Error("ログインが必要です");
      const idToken = await user.getIdToken();
      return fetch(path, {
        ...init,
        headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${idToken}` },
      });
    },
    [user]
  );

  const load = useCallback(async () => {
    const res = await api("/api/admin/showcase");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? "読み込みに失敗しました");
    setItems(json.items);
    setCandidates(json.candidates);
  }, [api]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api("/api/admin/showcase");
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error ?? "読み込みに失敗しました");
        setItems(json.items);
        setCandidates(json.candidates);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "読み込みに失敗しました");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, api]);

  async function addCandidate(c: ShowcaseCandidate) {
    const key = `${c.orderId}_${c.itemIndex}`;
    setAdding(key);
    setError(null);
    try {
      const res = await api("/api/admin/showcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: c.orderId,
          itemIndex: c.itemIndex,
          useCustomerImage: useCustomer[key] === true,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "追加に失敗しました");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "追加に失敗しました");
    } finally {
      setAdding(null);
    }
  }

  if (items === null) {
    return <p className="text-sm text-slate-500">{error ?? "読み込み中..."}</p>;
  }

  const addable = candidates.filter((c) => !c.added);

  return (
    <div className="space-y-8">
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">作成例({items.length}件)</h2>
        {items.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            まだありません。下の「掲載の許可がある注文」から追加してください。
          </p>
        ) : (
          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {items.map((item) => (
              <ItemEditor
                // Remount when the saved values change so the draft fields pick up the server state.
                key={`${item.id}-${item.title}-${item.caption}-${item.order}-${item.showOnHome}-${item.published}-${item.photoUrl}`}
                item={item}
                api={api}
                onChanged={load}
                onError={setError}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">
          掲載の許可がある注文(支払い済み・{addable.length}点)
        </h2>
        {addable.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            追加できる注文はありません。
          </p>
        ) : (
          <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {addable.map((c) => {
              const key = `${c.orderId}_${c.itemIndex}`;
              return (
                <div key={key} className="flex items-center gap-3 p-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {c.previewUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- Firebase Storage URL
                      <img src={c.previewUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-900">
                      注文 {c.orderNumber ?? c.orderId} の{c.itemIndex + 1}点目
                    </p>
                    {c.hasCustomerImage && (
                      <label className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <input
                          type="checkbox"
                          checked={useCustomer[key] === true}
                          onChange={(e) => setUseCustomer((p) => ({ ...p, [key]: e.target.checked }))}
                          className="h-3.5 w-3.5 accent-slate-800"
                        />
                        お客様の元の写真も使う
                      </label>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={adding !== null}
                    onClick={() => addCandidate(c)}
                    className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    {adding === key ? "コピー中..." : "作成例に追加"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-slate-400">
          追加すると3Dモデルを専用の場所にコピーします(発送後7日で消える元ファイルとは別なので、残ります)。氏名・住所・メールは保存も表示もしません。
        </p>
      </section>
    </div>
  );
}

export default function AdminShowcasePage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link href="/admin" className="mb-4 inline-block text-sm text-slate-600 underline underline-offset-2">
        ← 注文一覧に戻る
      </Link>
      <h1 className="mb-2 text-xl font-bold text-slate-900">作成例ギャラリー</h1>
      <p className="mb-6 text-sm text-slate-500">
        掲載を許可してくれたお客様の作品を、ホームと「作成例」ページに載せます。実物の写真はここでアップロードします。
      </p>
      <ShowcaseAdmin />
    </main>
  );
}
