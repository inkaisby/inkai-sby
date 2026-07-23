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
import { AuthTransitionOverlay } from "@/components/auth/AuthTransitionOverlay";
import {
  isPortalOrAuthTransition,
  transitionMessageForPath,
} from "@/lib/portal-transition";

const OVERLAY_SAFETY_MS = 8_000;

type NavigationContextValue = {
  isNavigating: boolean;
  pendingHref: string | null;
  /** Navigasi dalam shell atau antar portal (auto-deteksi overlay logo). */
  startNavigation: (href: string) => void;
  /** Overlay logo eksplisit (logout / auth manual). */
  beginAuthTransition: (message: string) => void;
};

const NavigationContext = createContext<NavigationContextValue>({
  isNavigating: false,
  pendingHref: null,
  startNavigation: () => {},
  beginAuthTransition: () => {},
});

function pathOnly(href: string) {
  return href.split("?")[0].split("#")[0] || "/";
}

function isInternalHref(href: string | null): href is string {
  if (!href || href.startsWith("#")) return false;
  if (
    href.startsWith("http") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return false;
  }
  return true;
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [overlayMessage, setOverlayMessage] = useState<string | null>(null);
  const [thinProgress, setThinProgress] = useState(false);

  const clearAll = useCallback(() => {
    setPendingHref(null);
    setOverlayMessage(null);
    setThinProgress(false);
  }, []);

  const startNavigation = useCallback(
    (href: string) => {
      const path = pathOnly(href);
      if (path === pathname) return;

      setPendingHref(href);
      if (isPortalOrAuthTransition(pathname, path)) {
        setOverlayMessage(transitionMessageForPath(path));
        setThinProgress(false);
      } else {
        setOverlayMessage(null);
        setThinProgress(true);
      }
    },
    [pathname],
  );

  const beginAuthTransition = useCallback((message: string) => {
    setOverlayMessage(message);
    setThinProgress(false);
    setPendingHref("__auth__");
  }, []);

  // Selesai saat URL berubah — tanpa delay buatan.
  useEffect(() => {
    clearAll();
  }, [pathname, clearAll]);

  // Jaga-jaga overlay tidak nyangkut jika navigasi gagal.
  useEffect(() => {
    if (!overlayMessage && !thinProgress) return;
    const id = window.setTimeout(clearAll, OVERLAY_SAFETY_MS);
    return () => window.clearTimeout(id);
  }, [overlayMessage, thinProgress, pendingHref, clearAll]);

  // Klik link internal (publik ↔ portal, dll.) tanpa wajib panggil startNavigation.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as HTMLElement).closest("a");
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }
      const href = anchor.getAttribute("href");
      if (!isInternalHref(href)) return;
      const path = pathOnly(href);
      if (path === pathname) return;

      if (isPortalOrAuthTransition(pathname, path)) {
        setPendingHref(href);
        setOverlayMessage(transitionMessageForPath(path));
        setThinProgress(false);
      } else {
        setPendingHref(href);
        setOverlayMessage(null);
        setThinProgress(true);
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  const isNavigating = pendingHref !== null;

  return (
    <NavigationContext.Provider
      value={{
        isNavigating,
        pendingHref,
        startNavigation,
        beginAuthTransition,
      }}
    >
      {children}
      <AuthTransitionOverlay
        active={Boolean(overlayMessage)}
        message={overlayMessage || "Memuat..."}
      />
      {thinProgress && !overlayMessage ? (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-inkai-red/15"
          aria-hidden
        >
          <div className="h-full w-1/3 animate-[navigation-progress_0.7s_ease-in-out_infinite] bg-inkai-red" />
        </div>
      ) : null}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  return useContext(NavigationContext);
}
