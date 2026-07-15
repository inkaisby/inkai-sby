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

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const startNavigation = useCallback((href: string) => {
    if (href !== pathname) setPendingHref(href);
  }, [pathname]);

  return (
    <NavigationContext.Provider
      value={{
        isNavigating: pendingHref !== null,
        pendingHref,
        startNavigation,
      }}
    >
      {children}
      {pendingHref !== null && (
        <div
          className="pointer-events-none fixed inset-x-0 top-16 z-50 h-0.5 overflow-hidden bg-muted"
          aria-hidden
        >
          <div className="h-full w-1/3 animate-[navigation-progress_1s_ease-in-out_infinite] bg-inkai-red" />
        </div>
      )}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  return useContext(NavigationContext);
}
