"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

const SESSION_KEY = "lumina-intro-seen";
const FALLBACK_MS = 12000;
const SHRINK_MS = 850;

export function IntroSplash({
  targetRef,
}: {
  targetRef: RefObject<HTMLImageElement | null>;
}) {
  const [visible, setVisible] = useState(true);
  const [shrinking, setShrinking] = useState(false);
  const [videoStyle, setVideoStyle] = useState<CSSProperties>({});
  const videoWrapRef = useRef<HTMLDivElement>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a browser-only store on mount, no way to derive this during render
      setVisible(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const fallback = window.setTimeout(shrinkToLogo, FALLBACK_MS);
    return () => window.clearTimeout(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function shrinkToLogo() {
    if (finishedRef.current) return;
    finishedRef.current = true;

    const target = targetRef.current;
    const source = videoWrapRef.current;
    if (target && source) {
      const t = target.getBoundingClientRect();
      const s = source.getBoundingClientRect();
      const scale = t.width / s.width;
      const dx = t.left + t.width / 2 - (s.left + s.width / 2);
      const dy = t.top + t.height / 2 - (s.top + s.height / 2);
      setVideoStyle({ transform: `translate(${dx}px, ${dy}px) scale(${scale})` });
    }
    setShrinking(true);
    sessionStorage.setItem(SESSION_KEY, "1");
    window.setTimeout(() => setVisible(false), SHRINK_MS);
  }

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-700 ${
        shrinking ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div
        ref={videoWrapRef}
        className="h-full w-full opacity-100 transition-[transform,opacity] ease-in-out"
        style={{
          transitionDuration: `${SHRINK_MS}ms`,
          opacity: shrinking ? 0 : 1,
          ...videoStyle,
        }}
      >
        <video
          src="/logo-intro.mp4"
          autoPlay
          muted
          playsInline
          onEnded={shrinkToLogo}
          onError={shrinkToLogo}
          className="h-full w-full object-cover"
        />
      </div>
      {!shrinking && (
        <button
          type="button"
          onClick={shrinkToLogo}
          className="absolute bottom-8 right-8 rounded-full border border-white/40 px-5 py-2 text-xs font-medium text-white/80 transition-colors hover:border-white hover:text-white"
        >
          スキップ
        </button>
      )}
    </div>
  );
}
