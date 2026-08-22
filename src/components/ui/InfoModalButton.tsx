"use client";

import { Info, X } from "lucide-react";
import Image from "next/image";
import { useState, type ReactNode } from "react";

type InfoModalButtonProps = {
  label: string;
  title: string;
  imageSrc?: string;
  imageAlt?: string;
  children: ReactNode;
};

export function InfoModalButton({
  label,
  title,
  imageSrc,
  imageAlt,
  children,
}: InfoModalButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-slate-600"
      >
        <Info className="h-4 w-4" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{title}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="閉じる"
                className="shrink-0 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {imageSrc && (
              <div className="relative mb-2 aspect-square overflow-hidden rounded-xl bg-slate-100">
                <Image
                  src={imageSrc}
                  alt={imageAlt ?? title}
                  fill
                  className="object-cover"
                  sizes="360px"
                />
              </div>
            )}
            <div className="text-xs leading-relaxed text-slate-600">
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
