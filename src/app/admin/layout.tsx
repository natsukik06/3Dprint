import Image from "next/image";
import Link from "next/link";
import { AdminGate } from "@/components/admin/AdminGate";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AdminGate>
      <div className="min-h-full bg-slate-50">
        <header className="print:hidden border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/admin" className="flex items-center gap-2">
              <Image
                src="/logo-charo3d-v2.png"
                alt="Charo 3D"
                width={938}
                height={1004}
                priority
                className="h-6 w-auto"
              />
              <span className="text-[11px] font-medium text-slate-400">
                管理画面
              </span>
            </Link>
            <Link
              href="/"
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              サイトを見る →
            </Link>
          </div>
        </header>
        {children}
      </div>
    </AdminGate>
  );
}
