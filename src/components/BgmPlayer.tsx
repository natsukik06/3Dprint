"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

const STORAGE_KEY = "lumina-bgm-on";
const VOLUME = 0.35;

export function BgmPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (localStorage.getItem(STORAGE_KEY) === "1") {
      audio.volume = VOLUME;
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => {
          /* autoplay blocked without a user gesture; leave paused */
        });
    }
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      localStorage.setItem(STORAGE_KEY, "0");
      return;
    }
    audio.volume = VOLUME;
    audio
      .play()
      .then(() => {
        setPlaying(true);
        localStorage.setItem(STORAGE_KEY, "1");
      })
      .catch(() => {
        /* ignore -- stays paused */
      });
  }

  return (
    <>
      <audio ref={audioRef} src="/bgm.mp3" loop preload="none" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "BGMを止める" : "BGMを再生する"}
        className="fixed bottom-5 left-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/80 text-[#3f3424] shadow-md backdrop-blur transition-colors hover:bg-white dark:border-white/10 dark:bg-black/60 dark:text-[#eef2f1] dark:hover:bg-black/80"
      >
        {playing ? (
          <Volume2 className="h-5 w-5" />
        ) : (
          <VolumeX className="h-5 w-5" />
        )}
      </button>
    </>
  );
}
