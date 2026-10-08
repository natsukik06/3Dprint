"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

function Elapsed() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="tabular-nums">{seconds}秒</span>;
}

// A message pinned to the bottom of the screen while something slow is running (making the images, the
// 3D model). Generating takes a minute or two, and the progress spot in the page can be scrolled out of
// view on a phone -- so right after tapping a button the customer always sees, wherever they are on the
// page, that the tap was received and that it is working, with a running seconds counter.
export function BusyBanner({
  active,
  title,
  detail,
}: {
  active: boolean;
  title: string;
  detail?: string;
}) {
  if (!active) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4"
    >
      <div className="flex max-w-md items-start gap-3 rounded-2xl bg-slate-900/95 px-4 py-3 text-white shadow-xl">
        <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
        <div className="text-sm leading-snug">
          <p className="font-semibold">
            {title}（<Elapsed />）
          </p>
          {detail && <p className="mt-0.5 text-xs text-slate-300">{detail}</p>}
        </div>
      </div>
    </div>
  );
}
