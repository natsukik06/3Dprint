"use client";

import { useEffect, useState } from "react";
import { defaultColorSettings, type ColorSettingsMap } from "@/lib/colorSettings";

// Shared by SpecOptions (which colors to show + their surcharge) and EstimateSummary/orders.ts
// (the surcharge feeds into calculateEstimate) -- each caller does its own small fetch rather than
// threading a context through the tree, since the payload is tiny and rarely changes.
export function useColorSettings(): { settings: ColorSettingsMap; loaded: boolean } {
  const [settings, setSettings] = useState<ColorSettingsMap>(defaultColorSettings());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/color-settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ColorSettingsMap | null) => {
        if (cancelled || !data) return;
        setSettings(data);
      })
      .catch(() => {
        // Network hiccup -- fall back to the code-level defaults already in state.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { settings, loaded };
}
