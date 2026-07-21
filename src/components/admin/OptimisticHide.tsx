"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

const HideContext = createContext<(() => void) | null>(null);

/** Sembunyikan baris/kartu segera setelah aksi sukses (tanpa tunggu RSC refresh). */
export function OptimisticHide({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const hide = useCallback(() => setHidden(true), []);
  if (hidden) return null;
  return (
    <HideContext.Provider value={hide}>{children}</HideContext.Provider>
  );
}

export function useOptimisticHide() {
  return useContext(HideContext);
}
