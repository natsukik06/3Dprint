"use client";

import { useEffect, useRef, useState } from "react";

const SESSION_KEY = "lumina-intro-seen";

export function IntroSplash() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a browser-only store on mount, no way to derive this during render
      setVisible(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const fallback = window.setTimeout(finish, 12000);
    return () => window.clearTimeout(fallback);
  }, [visible]);

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    sessionStorage.setItem(SESSION_KEY, "1");
    setFading(true);
    window.setTimeout(() => setVisible(false), 700);
  }

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-700 ${
        fading ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <video
        src="/hero-video.mp4"
        autoPlay
        muted
        playsInline
        onEnded={finish}
        onError={finish}
        className="h-full w-full object-cover"
      />
      <button
        type="button"
        onClick={finish}
        className="absolute bottom-8 right-8 rounded-full border border-white/40 px-5 py-2 text-xs font-medium text-white/80 transition-colors hover:border-white hover:text-white"
      >
        スキップ
      </button>
    </div>
  );
}
