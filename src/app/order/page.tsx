import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { CreditPurchase } from "@/components/auth/CreditPurchase";
import { LoginButton } from "@/components/auth/LoginButton";
import { OrderForm } from "@/components/order/OrderForm";
import { isOrderingOpen } from "@/lib/orderCap";
import { CREDIT_PRICE_YEN } from "@/lib/creditPacks";

export const metadata = { title: "ご注文（写真から作る）" };

// Must be checked fresh on every request -- the monthly order-cap count would otherwise be
// baked in once at build time and never re-checked.
export const dynamic = "force-dynamic";

export default async function OrderPage() {
  const orderingOpen = await isOrderingOpen();

  return (
    <div className="min-h-full bg-slate-50">
      <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 md:max-w-2xl lg:max-w-3xl lg:px-8">
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
              src="/logo-charo3d-v2.png"
              alt="Charo 3D"
              width={938}
              height={1004}
              priority
              className="mx-auto h-auto w-36 sm:w-40 lg:w-44"
            />
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            ペットや大切なものの写真から、魔法のカラーで輝くクリスタルフィギュアを作成・注文できます。
          </p>
          <p className="mt-2 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            ①写真から4方向のイメージを作る工程は1日2回まで無料、②3Dモデルを作る工程は1回¥{CREDIT_PRICE_YEN}（初回は無料）で、仕上がりを確認してからご注文いただけます
          </p>
        </header>
        {orderingOpen ? (
          <Suspense fallback={null}>
            <OrderForm />
          </Suspense>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              今週の受付は終了しました
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              一人で製作しているため、週ごとにご注文数の上限を設けております。
              大変申し訳ございませんが、来週の受付開始までお待ちください。
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
