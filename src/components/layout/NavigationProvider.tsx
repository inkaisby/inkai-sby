"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

type NavigationContextValue = {
  isNavigating: boolean;
  pendingHref: string | null;
  startNavigation: (href: string) => void;
};

const NavigationContext = createContext<NavigationContextValue>({
  isNavigating: false,
  pendingHref: null,
  startNavigation: () => {},
});

export function NavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const startNavigation = useCallback(
    (href: string) => {
      const path = href.split("?")[0].split("#")[0];
      if (path !== pathname) {
        setPendingHref(href);
      }
    },
    [pathname],
  );

  // Hapus indikator segera saat URL berubah — tanpa delay buatan.
  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const isNavigating = pendingHref !== null;

  return (
    <NavigationContext.Provider
      value={{
        isNavigating,
        pendingHref,
        startNavigation,
      }}
    >
      {children}
      {isNavigating && (
        <div
          className="pointer-events-none fixed inset-x-0 top-12 z-50 h-0.5 overflow-hidden bg-muted sm:top-16"
          aria-hidden
        >
          <div className="h-full w-1/3 animate-[navigation-progress_0.7s_ease-in-out_infinite] bg-inkai-red" />
        </div>
      )}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  return useContext(NavigationContext);
}
