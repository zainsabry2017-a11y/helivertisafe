import { useRef, useEffect } from "react";

export function useAutoSave(key, state, mode) {
  const saveTimer = useRef(null);
  useEffect(() => {
    if (mode !== "app") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        if (window.storage) {
          await window.storage.set(key, JSON.stringify({ ts: Date.now(), proj: state.proj, site: state.site, zones: state.zones.map(z => ({ ...z, sc: null })), scenarios: state.scenarios }));
        }
      } catch { /* storage unavailable */ }
    }, 3000); // save 3s after last change
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [state.proj, state.site, state.zones, state.scenarios, mode, key]);
}

// Load auto-saved state
export async function loadAutoSave(key) {
  try {
    if (!window.storage) return null;
    const result = await window.storage.get(key);
    if (result?.value) { const d = JSON.parse(result.value); if (d.proj && d.site) return d; }
  } catch { /* ignore */ }
  return null;
}
