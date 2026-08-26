import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { CreditPurchase } from "@/components/auth/CreditPurchase";
import { LoginButton } from "@/components/auth/LoginButton";
import { OrderForm } from "@/components/order/OrderForm";

export default function OrderPage() {
  return (
    <div className="min-h-full bg-slate-50">
      <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            トップに戻る
          </Link>
          <div className="flex flex-col items-end gap-2">
            <LoginButton />
            <CreditPurchase />
          </div>
        </div>
        <header className="mb-6 text-center">
          <h1 className="mx-auto">
            <Image
              src="/logo-full.png"
              alt="LUMINA CHARO"
              width={1569}
              height={1034}
              priority
              className="mx-auto h-auto w-44 sm:w-52"
            />
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            ペットや大切なものの写真から、魔法のカラーで輝くクリスタルフィギュアを作成・注文できます。
          </p>
        </header>
        <Suspense fallback={null}>
          <OrderForm />
        </Suspense>
      </main>
    </div>
  );
}
