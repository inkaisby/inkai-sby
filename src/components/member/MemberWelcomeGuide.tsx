"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  FALLBACK_MEMBER_GUIDE,
  fetchMemberGuideResolved,
  guideIsActive,
  type MemberWelcomeGuideJson,
} from "@/lib/memberGuide";

const STORAGE_KEY = "inkai_sby_member_welcome_seen_version";

export function MemberWelcomeGuide() {
  const [guide, setGuide] = useState<MemberWelcomeGuideJson | null>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    fetchMemberGuideResolved()
      .then((g) => {
        if (!cancelled) setGuide(g);
      })
      .catch(() => {
        if (!cancelled) setGuide(FALLBACK_MEMBER_GUIDE);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mounted || !guide || !guideIsActive(guide)) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === guide.version) return;
    } catch {
      return;
    }
    setOpen(true);
  }, [mounted, guide]);

  const dismiss = useCallback(() => {
    if (!guide) return;
    try {
      localStorage.setItem(STORAGE_KEY, guide.version);
    } catch {
      /* ignore */
    }
    setOpen(false);
  }, [guide]);

  if (!mounted || !guide || !guideIsActive(guide) || !open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 animate-in fade-in duration-200"
        aria-label="Tutup"
        onClick={dismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-welcome-title"
        className="relative z-[1] w-full max-w-[480px] animate-in slide-in-from-bottom duration-300 rounded-t-3xl border border-border bg-card px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3 shadow-2xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <h2 id="member-welcome-title" className="text-lg font-extrabold">
          {guide.title}
        </h2>
        {guide.subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{guide.subtitle}</p>
        ) : null}
        <div className="mt-4 max-h-[40vh] space-y-3 overflow-y-auto">
          {guide.items.map((item) => (
            <div key={item.heading} className="rounded-2xl bg-muted/50 p-3">
              <p className="text-sm font-bold">{item.heading}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
        {guide.footer ? (
          <p className="mt-3 text-xs text-muted-foreground">{guide.footer}</p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="w-full rounded-xl bg-inkai-red py-3 text-sm font-semibold text-white hover:bg-inkai-red/90"
          >
            {guide.primaryCtaLabel ?? "Mengerti"}
          </button>
          {guide.fullGuidePath ? (
            <Link
              href={guide.fullGuidePath}
              onClick={dismiss}
              className="w-full rounded-xl border border-border py-3 text-center text-sm font-semibold"
            >
              {guide.fullGuideLinkLabel ?? "Buka halaman panduan"}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
