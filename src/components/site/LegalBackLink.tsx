"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

const LINK_CLASS = "inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900";

function BackLink({ className }: { className?: string }) {
  // The order form's consent step links here with ?from=order -- send those readers back to
  // /order (the in-progress order is restored from the saved draft) instead of to the top page.
  const fromOrder = useSearchParams().get("from") === "order";
  return (
    <Link href={fromOrder ? "/order" : "/"} className={`${LINK_CLASS} ${className ?? ""}`}>
      <ArrowLeft className="h-4 w-4" />
      {fromOrder ? "ご注文に戻る" : "トップに戻る"}
    </Link>
  );
}

// Back link for the legal pages (特定商取引法 / 返品 / プライバシー). useSearchParams needs a
// Suspense boundary on statically rendered pages; the fallback is the plain top-page link.
export function LegalBackLink({ className }: { className?: string }) {
  return (
    <Suspense
      fallback={
        <Link href="/" className={`${LINK_CLASS} ${className ?? ""}`}>
          <ArrowLeft className="h-4 w-4" />
          トップに戻る
        </Link>
      }
    >
      <BackLink className={className} />
    </Suspense>
  );
}
