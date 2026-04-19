import { createContext, useContext } from "react";

/** Full workflow API for step views (Phase 1 shell + steps). */
export const HvsContext = createContext(null);

export function useHvs() {
  const v = useContext(HvsContext);
  if (!v) throw new Error("useHvs must be used within HvsContext.Provider");
  return v;
}
