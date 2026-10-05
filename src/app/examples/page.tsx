import type { Metadata } from "next";
import Link from "next/link";
import { ShowcaseCard } from "@/components/showcase/ShowcaseCard";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { displayFont as display, zenGothic, zenMincho } from "@/lib/fonts";
import { getPublishedShowcase } from "@/lib/showcase";

export const metadata: Metadata = {
  title: "作成例",
  description: "ご注文のお客様に許可をいただいた、実際のクリスタルキーホルダーの作成例です。",
};

// 反映ボタン(/api/admin/showcase/.../publish)で on-demand 再生成。念のため1時間でも更新する。
export const revalidate = 3600;

export default async function ExamplesPage() {
  const items = await getPublishedShowcase();

  return (
    <div
      className={`${zenGothic.variable} ${zenMincho.variable} min-h-full bg-[#f4ecdc] text-[#3f3424] dark:bg-[#0a0a0c] dark:text-[#eef2f1]`}
      style={{ fontFamily: "var(--font-zen-gothic), sans-serif" }}
    >
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6 md:max-w-2xl lg:max-w-4xl lg:px-8 lg:py-16">
        <header className="mb-10 text-center">
          <span
            className="mb-3 block text-xs italic tracking-[0.2em] text-[#8a5a34] dark:text-[#7fd8cb]"
            style={display}
          >
            EXAMPLES
          </span>
          <h1 className="text-2xl font-semibold leading-relaxed lg:text-3xl" style={display}>
            作成例
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[#6b5c40] dark:text-[#9fb0ae]">
            ご注文のお客様に掲載の許可をいただいた、実際の作品です。完成品の写真と3Dモデルを見比べられます。
          </p>
        </header>

        {items.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <ShowcaseCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-sm leading-7 text-[#6b5c40] dark:text-[#9fb0ae]">
            作成例は準備中です。
          </p>
        )}

        <div className="mt-12 text-center">
          <Link
            href="/order"
            className="inline-block rounded-full bg-[#0f766e] px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#0b5b54] dark:bg-[#7fd8cb] dark:text-[#0a0a0c] dark:hover:bg-[#9fe6da]"
          >
            注文する
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
