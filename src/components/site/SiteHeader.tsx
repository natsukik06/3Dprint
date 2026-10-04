import Link from "next/link";
import Image from "next/image";
import { AuthNavButton } from "@/components/site/AuthNavButton";

// Shared nav for every page except the homepage hero, which overlays its own transparent/white
// version on the hero video instead (see src/app/page.tsx) -- this one needs a solid background
// since it sits directly on each page's own content, not on top of a video.
export function SiteHeader() {
  return (
    <header className="border-b border-[#e0d3b8] bg-[#f4ecdc] dark:border-[#232726] dark:bg-[#0a0a0c]">
      <nav className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-4 sm:px-6 md:max-w-2xl lg:max-w-4xl lg:px-8">
        <Link href="/">
          <Image
            src="/logo-charo3d-v2.png"
            alt="Charo 3D"
            width={938}
            height={1004}
            className="h-9 w-auto dark:invert lg:h-11"
          />
        </Link>
        <div className="flex items-center gap-2.5 whitespace-nowrap text-[11px] font-medium text-[#3f3424] dark:text-[#eef2f1] sm:gap-4 sm:text-xs lg:gap-6 lg:text-sm">
          <Link href="/products" className="hover:text-[#0f766e] dark:hover:text-[#7fd8cb]">
            料金
          </Link>
          <Link
            href="/story"
            className="hidden hover:text-[#0f766e] dark:hover:text-[#7fd8cb] sm:inline"
          >
            ものがたり
          </Link>
          <Link
            href="/guide/faq"
            className="hidden hover:text-[#0f766e] dark:hover:text-[#7fd8cb] sm:inline"
          >
            よくある質問
          </Link>
          <AuthNavButton className="hover:text-[#0f766e] dark:hover:text-[#7fd8cb]" />
          <Link
            href="/order"
            className="rounded-full bg-[#0f766e] px-3 py-1.5 text-white transition-colors hover:bg-[#0b5b54] dark:bg-[#7fd8cb] dark:text-[#0a0a0c] dark:hover:bg-[#9fe6da] sm:px-4 sm:py-2 lg:px-5 lg:py-2.5"
          >
            注文する
          </Link>
        </div>
      </nav>
    </header>
  );
}
