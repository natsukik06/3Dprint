"use client";

import { ImageUp, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { downscaleImage } from "@/lib/imageResize";
import { MAX_REFERENCE_PHOTOS } from "@/types/order";

type PhotoUploaderProps = {
  photos: File[];
  onChange: (photos: File[]) => void;
  error?: string;
  // Lower than MAX_REFERENCE_PHOTOS where several uploaders share one request (the duo builder).
  maxPhotos?: number;
};

const SLOT_LABELS: Record<number, string> = {
  0: "①全体像",
  1: "②特徴",
};

function PhotoThumbnail({
  file,
  slotLabel,
  onRemove,
}: {
  file: File;
  slotLabel?: string;
  onRemove: () => void;
}) {
  // Deliberately NOT `useState(() => URL.createObjectURL(file))` -- under React Strict Mode's
  // dev-only mount/cleanup/remount double-invoke, that pattern creates the URL once during the
  // state initializer, then the effect's cleanup revokes that same URL on the simulated
  // unmount, leaving the still-mounted <img> pointing at an already-revoked blob URL (shows
  // broken/blank). Creating the URL INSIDE the effect instead means the double-invoke's second
  // mount creates a fresh, valid URL rather than reusing the one that just got revoked.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    // The object URL is a resource that must be created and revoked as a matching pair (see
    // comment above), so the create-and-store has to happen together in the effect, not via
    // useMemo (which would create an extra URL every Strict Mode double-invoke with no way to
    // revoke the discarded one).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {previewUrl && (
        <Image
          src={previewUrl}
          alt={file.name}
          fill
          className="object-cover"
          unoptimized
        />
      )}
      {slotLabel && (
        <span className="absolute bottom-0 left-0 right-0 truncate bg-black/60 px-1 py-0.5 text-center text-[9px] text-white">
          {slotLabel}
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="この写真を削除"
        className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function PhotoUploader({ photos, onChange, error, maxPhotos }: PhotoUploaderProps) {
  const max = Math.min(maxPhotos ?? MAX_REFERENCE_PHOTOS, MAX_REFERENCE_PHOTOS);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isProcessing, setIsProcessing] = useState(false);

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = max - photos.length;
    const selected = Array.from(files).slice(0, remaining);
    if (inputRef.current) inputRef.current.value = "";
    // Large phone photos are shrunk here so they fit the server's request-size limit -- see
    // downscaleImage in src/lib/imageResize.ts.
    setIsProcessing(true);
    try {
      const additions = await Promise.all(selected.map(downscaleImage));
      onChange([...photos, ...additions]);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleRemove(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  // The first photo is read as the 全体像 (main reference) and the second as the 特徴 (feature close-up),
  // so choosing a role afterwards is just moving that photo into the slot.
  function moveTo(from: number, to: number) {
    if (from === to || from < 0 || from >= photos.length) return;
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(Math.min(to, next.length), 0, moved);
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">
        「全体像」は一番参考にしたい写真、「特徴」は顔のアップや模様がわかる写真です。写真を追加したあとでも、「全体像にする」「特徴にする」で選び直せます（正面・横・後ろなど角度違いがあるとさらに精度が上がります・最大{max}枚）
      </p>
      <Link
        href="/guide/photo-tips"
        target="_blank"
        className="inline-block text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700"
      >
        良い写真・避けたい写真の例を見る
      </Link>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      <div className="flex flex-wrap gap-2">
        {photos.map((file, index) => (
          <div key={`${file.name}-${index}`} className="flex w-20 shrink-0 flex-col gap-1">
            <PhotoThumbnail
              file={file}
              slotLabel={SLOT_LABELS[index] ?? "参考"}
              onRemove={() => handleRemove(index)}
            />
            {photos.length > 1 && (
              <>
                {index !== 0 && (
                  <button
                    type="button"
                    onClick={() => moveTo(index, 0)}
                    className="rounded border border-slate-300 bg-white py-0.5 text-[10px] text-slate-600 hover:bg-slate-50"
                  >
                    全体像にする
                  </button>
                )}
                {index !== 1 && (
                  <button
                    type="button"
                    onClick={() => moveTo(index, 1)}
                    className="rounded border border-slate-300 bg-white py-0.5 text-[10px] text-slate-600 hover:bg-slate-50"
                  >
                    特徴にする
                  </button>
                )}
              </>
            )}
          </div>
        ))}
        {photos.length < max && (
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-slate-400 hover:bg-slate-100"
          >
            <ImageUp className="h-5 w-5" />
            <span className="text-[10px]">{isProcessing ? "処理中" : "追加"}</span>
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
