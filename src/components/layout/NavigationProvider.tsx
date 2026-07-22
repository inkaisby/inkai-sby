"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

/** Keep logo loader visible briefly so fast navigations still feel polished. */
const MIN_NAVIGATION_MS = 180;

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
  const [isNavigating, setIsNavigating] = useState(false);
  const navStartedAt = useRef<number | null>(null);

  const startNavigation = useCallback((href: string) => {
    if (href !== pathname) {
      navStartedAt.current = Date.now();
      setPendingHref(href);
      setIsNavigating(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (!pendingHref || navStartedAt.current === null) return;

    const elapsed = Date.now() - navStartedAt.current;
    const remaining = Math.max(0, MIN_NAVIGATION_MS - elapsed);

    const timer = setTimeout(() => {
      setPendingHref(null);
      setIsNavigating(false);
      navStartedAt.current = null;
    }, remaining);

    return () => clearTimeout(timer);
  }, [pathname, pendingHref]);

  return (
    <NavigationContext.Provider
      value={{
        isNavigating,
        pendingHref,
        startNavigation,
      }}
    >
      {children}
      {pendingHref !== null && (
        <div
          className="pointer-events-none fixed inset-x-0 top-12 z-50 h-0.5 overflow-hidden bg-muted sm:top-16"
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
