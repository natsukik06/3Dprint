import Link from "next/link";
import { ShowcaseCard } from "@/components/showcase/ShowcaseCard";
import { displayFont as display } from "@/lib/fonts";
import { getPublishedShowcase } from "@/lib/showcase";

// Server component: shown on the home page only when at least one 作成例 is published for the home
// (showOnHome). With none, it renders nothing at all -- no empty frame.
export async function HomeShowcaseSection() {
  const items = await getPublishedShowcase({ homeOnly: true });
  if (items.length === 0) return null;

  return (
    <section className="border-t border-[#d9cbb0] py-16 dark:border-[#1c1f1e] sm:py-20">
      <div className="mx-auto w-full max-w-xl px-4 sm:px-6 md:max-w-2xl lg:max-w-4xl lg:px-8">
        <div className="mb-8 text-center">
          <span
            className="mb-2 block text-xs italic tracking-[0.2em] text-[#8a5a34] dark:text-[#7fd8cb]"
            style={display}
          >
            EXAMPLES
          </span>
          <h2 className="text-2xl font-semibold leading-relaxed" style={display}>
            作成例
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[#6b5c40] dark:text-[#9fb0ae]">
            ご注文のお客様に許可をいただいた、実際の作品です。
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {items.map((item) => (
            <ShowcaseCard key={item.id} item={item} />
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/examples"
            className="inline-block rounded-full border border-[#0f766e] px-6 py-2.5 text-sm font-semibold text-[#0f766e] transition-colors hover:bg-[#0f766e] hover:text-white dark:border-[#7fd8cb] dark:text-[#7fd8cb] dark:hover:bg-[#7fd8cb] dark:hover:text-[#0a0a0c]"
          >
            作成例をもっと見る →
          </Link>
        </div>
      </div>
    </section>
  );
}
