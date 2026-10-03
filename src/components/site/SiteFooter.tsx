import Link from "next/link";

export function SiteFooter() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 sm:px-6 md:max-w-2xl lg:max-w-4xl lg:px-8">
      <footer className="flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-[#e0d3b8] py-8 text-xs text-[#8a7c5e] dark:border-[#232726] dark:text-[#6d7c79]">
        <Link href="/guide/faq" className="hover:text-[#3f3424] dark:hover:text-white">
          よくある質問
        </Link>
        <Link href="/legal/returns" className="hover:text-[#3f3424] dark:hover:text-white">
          返品・キャンセルについて
        </Link>
        <Link href="/legal/tokushoho" className="hover:text-[#3f3424] dark:hover:text-white">
          特定商取引法に基づく表記
        </Link>
        <Link href="/legal/privacy" className="hover:text-[#3f3424] dark:hover:text-white">
          プライバシーポリシー
        </Link>
      </footer>
    </div>
  );
}
