"use client";

import { useState } from "react";

// Shared by admin/orders/[id] (one order's label command) and admin/batches/[id] (every order in
// a batch, combined into one paste) -- a copy button next to a ready-to-run shell command, so
// printing a label is "copy, paste into a terminal, Enter" instead of retyping/reformatting by
// hand each time.
export function CopyCommandRow({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("failed to copy label command", error);
    }
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <div className="flex items-start gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre rounded-lg bg-slate-900 px-3 py-2 text-[11px] text-emerald-300">
          {command}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
        >
          {copied ? "コピー済み" : "コピー"}
        </button>
      </div>
    </div>
  );
}
