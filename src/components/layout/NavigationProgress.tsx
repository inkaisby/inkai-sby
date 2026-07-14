"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function isInternalNavLink(href: string | null, pathname: string) {
  if (!href || href.startsWith("#")) return false;
  if (
    href.startsWith("http") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return false;
  }
  const path = href.split("?")[0].split("#")[0];
  return path !== pathname;
}

export default function NavigationProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(false);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }
      if (isInternalNavLink(anchor.getAttribute("href"), pathname)) {
        setActive(true);
      }
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-inkai-red/20"
      aria-hidden
    >
      <div className="h-full w-1/3 animate-[nav-progress_0.8s_ease-in-out_infinite] bg-inkai-red" />
    </div>
  );
}
