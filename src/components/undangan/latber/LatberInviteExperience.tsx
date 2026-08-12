"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { LatberInvitePublic } from "@/lib/latber-invite";
import { InviteMusic } from "@/components/undangan/ukt/InviteMusic";
import {
  LatberAcaraTab,
  LatberHomeTab,
  LatberMapTab,
} from "./LatberInviteSections";
import "@/components/undangan/ukt/invite-motion.css";

const TABS = [
  { id: "home", label: "Home", ms: 8000 },
  { id: "acara", label: "Acara", ms: 8000 },
  { id: "peta", label: "Peta", ms: 9000 },
] as const;

type TabId = (typeof TABS)[number]["id"];

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function LatberInviteExperience({ invite }: { invite: LatberInvitePublic }) {
  const [opened, setOpened] = useState(false);
  const [active, setActive] = useState<TabId>("home");
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<TabId, HTMLElement | null>>({
    home: null,
    acara: null,
    peta: null,
  });
  const pauseUntilRef = useRef(0);
  const autoplayRef = useRef(true);
  const activeRef = useRef(active);
  activeRef.current = active;

  const pauseAutoplay = useCallback((ms = 12000) => {
    pauseUntilRef.current = Date.now() + ms;
  }, []);

  const scrollToTab = useCallback((id: TabId, behavior: ScrollBehavior = "smooth") => {
    const el = sectionRefs.current[id];
    el?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : behavior,
      block: "start",
    });
    setActive(id);
  }, []);

  useEffect(() => {
    if (!opened) return;
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting && e.intersectionRatio >= 0.55);
        if (!visible?.target) return;
        const id = (visible.target as HTMLElement).dataset.tab as TabId | undefined;
        if (!id || id === activeRef.current) return;
        activeRef.current = id;
        setActive(id);
      },
      { root, threshold: [0.55] },
    );
    for (const id of TABS.map((t) => t.id)) {
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [opened]);

  return (
    <div className="invite-ukt">
      <div className="invite-ukt__atmosphere" aria-hidden />

      <div className={`invite-ukt__cover ${opened ? "is-open" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-inkai.png"
          alt="INKAI Surabaya"
          width={96}
          height={96}
          className="invite-ukt__cover-logo"
          decoding="async"
          fetchPriority="high"
        />
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--invite-red)]">
          INKAI Surabaya
        </p>
        <p className="mt-3 text-sm text-[color:var(--invite-muted)]">
          Kepada Yth. Pengurus Ranting
        </p>
        <h1 className="invite-ukt__display mt-2 max-w-sm text-4xl sm:text-5xl">
          {invite.title}
        </h1>
        <div className="invite-ukt__belt-lines" aria-hidden>
          <span />
          <span />
        </div>
        <p className="mt-4 max-w-xs text-sm text-[color:var(--invite-muted)]">
          Undangan Latihan Bersama — cabang Surabaya
        </p>
        <button
          type="button"
          className="invite-ukt__open-btn"
          onClick={() => {
            setOpened(true);
            autoplayRef.current = !prefersReducedMotion();
          }}
        >
          Buka Undangan
        </button>
      </div>

      {opened ? (
        <div className="invite-ukt__shell is-visible">
          <div className="invite-ukt__sticky-actions">
            <InviteMusic active />
          </div>

          <nav className="invite-ukt__tabs" aria-label="Bagian undangan">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`invite-ukt__tab ${active === tab.id ? "is-active" : ""}`}
                onClick={() => {
                  pauseAutoplay();
                  scrollToTab(tab.id);
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div ref={scrollRef} className="invite-ukt__scroll">
            <section
              data-tab="home"
              ref={(el) => {
                sectionRefs.current.home = el;
              }}
            >
              <LatberHomeTab invite={invite} active={active === "home"} />
            </section>
            <section
              data-tab="acara"
              ref={(el) => {
                sectionRefs.current.acara = el;
              }}
            >
              <LatberAcaraTab invite={invite} />
            </section>
            <section
              data-tab="peta"
              ref={(el) => {
                sectionRefs.current.peta = el;
              }}
            >
              <LatberMapTab invite={invite} />
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
