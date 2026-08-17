"use client";

import { ImageUp, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { MAX_REFERENCE_PHOTOS } from "@/types/order";

type PhotoUploaderProps = {
  photos: File[];
  onChange: (photos: File[]) => void;
  error?: string;
};

function PhotoThumbnail({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const [previewUrl] = useState(() => URL.createObjectURL(file));

  useEffect(() => {
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

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

export function PhotoUploader({ photos, onChange, error }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = MAX_REFERENCE_PHOTOS - photos.length;
    const additions = Array.from(files).slice(0, remaining);
    onChange([...photos, ...additions]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleRemove(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">
        ペットや、立体化したいものの写真をアップロードしてください（正面・横・後ろなど色々な角度があると精度が上がります・最大{MAX_REFERENCE_PHOTOS}枚）
      </p>

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
          <PhotoThumbnail
            key={`${file.name}-${index}`}
            file={file}
            onRemove={() => handleRemove(index)}
          />
        ))}
        {photos.length < MAX_REFERENCE_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:border-slate-400 hover:bg-slate-100"
          >
            <ImageUp className="h-5 w-5" />
            <span className="text-[10px]">追加</span>
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
