import { NextResponse, type NextRequest } from "next/server";
import { unsubscribeByToken } from "@/lib/marketing";

function htmlPage(message: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>配信停止</title></head>` +
      `<body style="font-family:sans-serif;max-width:480px;margin:80px auto;padding:0 16px;text-align:center;">` +
      `<p>${message}</p></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return htmlPage("無効なリンクです。");
  }
  const found = await unsubscribeByToken(token);
  return htmlPage(
    found
      ? "配信を停止しました。ご利用ありがとうございました。"
      : "リンクが見つかりませんでした。すでに配信停止済みの可能性があります。"
  );
}
