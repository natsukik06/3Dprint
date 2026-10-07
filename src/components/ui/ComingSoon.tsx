// 準備中 cover for a card that is closed for now: diagonal stripes across the whole card plus a
// "準備中" tag. For customers (open = false) it sits on top and also swallows clicks. For the shop owner
// (open = true, only possible while testing) the stripes are gone and a small "テスト中" tag shows
// instead, so it is obvious the feature is still closed to everyone else.
export function ComingSoonOverlay({ open, labTest }: { open: boolean; labTest: boolean }) {
  if (open) {
    return labTest ? (
      <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
        テスト中（管理者のみ）
      </span>
    ) : null;
  }
  return (
    <div
      aria-hidden
      className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl"
      style={{
        backgroundImage:
          "repeating-linear-gradient(135deg, rgba(100,116,139,0.28) 0, rgba(100,116,139,0.28) 8px, rgba(255,255,255,0.0) 8px, rgba(255,255,255,0.0) 20px)",
      }}
    >
      <span className="rounded-full bg-slate-800 px-4 py-1.5 text-sm font-bold tracking-wide text-white shadow">
        準備中
      </span>
    </div>
  );
}
