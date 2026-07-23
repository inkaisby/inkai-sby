"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { UktInvitePublic } from "@/lib/ukt-invite";
import { InviteMusic } from "./InviteMusic";
import {
  AcaraTab,
  GalleryTab,
  HomeTab,
  MapTab,
} from "./InviteSections";
import "./invite-motion.css";

const TABS = [
  { id: "home", label: "Home", ms: 8000 },
  { id: "acara", label: "Acara", ms: 8000 },
  { id: "galeri", label: "Galeri", ms: 10000 },
  { id: "peta", label: "Peta", ms: 9000 },
] as const;

type TabId = (typeof TABS)[number]["id"];

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function UktInviteExperience({ invite }: { invite: UktInvitePublic }) {
  const [opened, setOpened] = useState(false);
  const [active, setActive] = useState<TabId>("home");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [progressKey, setProgressKey] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<TabId, HTMLElement | null>>({
    home: null,
    acara: null,
    galeri: null,
    peta: null,
  });
  const pauseUntilRef = useRef(0);
  const autoplayRef = useRef(true);
  const activeRef = useRef(active);
  const lightboxRef = useRef(lightbox);
  activeRef.current = active;
  lightboxRef.current = lightbox;

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
    setProgressKey((k) => k + 1);
    if (id === "peta") setMapReady(true);
  }, []);

  const openInvite = () => {
    setOpened(true);
    autoplayRef.current = !prefersReducedMotion();
  };

  // Sync active tab from scroll (satu threshold, hemat callback)
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
        setProgressKey((k) => k + 1);
        if (id === "peta") setMapReady(true);
      },
      { root, threshold: 0.55 },
    );

    for (const tab of TABS) {
      const el = sectionRefs.current[tab.id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [opened]);

  // Pause autoplay on user scroll (rAF throttle)
  useEffect(() => {
    if (!opened) return;
    const root = scrollRef.current;
    if (!root) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        pauseAutoplay();
        ticking = false;
      });
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [opened, pauseAutoplay]);

  // Auto-play: satu timeout berantai (bukan interval yang reset tiap ganti tab)
  useEffect(() => {
    if (!opened || prefersReducedMotion()) return;
    let cancelled = false;
    let timer: number | undefined;

    const schedule = () => {
      const current = TABS.find((t) => t.id === activeRef.current) ?? TABS[0];
      timer = window.setTimeout(() => {
        if (cancelled) return;
        if (!autoplayRef.current || lightboxRef.current) {
          schedule();
          return;
        }
        if (Date.now() < pauseUntilRef.current) {
          schedule();
          return;
        }
        if (document.visibilityState === "hidden") {
          schedule();
          return;
        }
        const idx = TABS.findIndex((t) => t.id === activeRef.current);
        const next = TABS[(idx + 1) % TABS.length];
        scrollToTab(next.id);
        schedule();
      }, current.ms);
    };

    schedule();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [opened, scrollToTab]);

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
          Undangan Ujian Kenaikan Tingkat — cabang Surabaya
        </p>
        <button type="button" className="invite-ukt__open-btn" onClick={openInvite}>
          Buka Undangan
        </button>
      </div>

      {/* Konten isi baru di-mount setelah buka — hemat parse/layout awal */}
      {opened ? (
        <div className="invite-ukt__shell is-visible">
          <div className="invite-ukt__sticky-actions">
            <InviteMusic active />
          </div>

          <div ref={scrollRef} className="invite-ukt__scroll">
            <section
              className="invite-ukt__section"
              data-tab="home"
              ref={(el) => {
                sectionRefs.current.home = el;
              }}
            >
              <HomeTab invite={invite} active={active === "home"} />
            </section>
            <section
              className="invite-ukt__section"
              data-tab="acara"
              ref={(el) => {
                sectionRefs.current.acara = el;
              }}
            >
              <AcaraTab invite={invite} />
            </section>
            <section
              className="invite-ukt__section invite-ukt__section--gallery"
              data-tab="galeri"
              ref={(el) => {
                sectionRefs.current.galeri = el;
              }}
            >
              <GalleryTab
                onLightbox={setLightbox}
                onInteract={() => pauseAutoplay(20000)}
              />
            </section>
            <section
              className="invite-ukt__section invite-ukt__section--map"
              data-tab="peta"
              ref={(el) => {
                sectionRefs.current.peta = el;
              }}
              onPointerDown={() => pauseAutoplay(20000)}
            >
              <MapTab invite={invite} mountMap={mapReady || active === "peta"} />
            </section>
          </div>

          <nav className="invite-ukt__tabs" aria-label="Navigasi undangan">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`invite-ukt__tab ${active === tab.id ? "is-active" : ""}`}
                style={
                  { "--invite-auto-ms": `${tab.ms}ms` } as CSSProperties
                }
                onClick={() => {
                  pauseAutoplay();
                  scrollToTab(tab.id);
                }}
              >
                {tab.label}
                {active === tab.id ? (
                  <span className="invite-ukt__tab-progress" key={progressKey}>
                    <i />
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        </div>
      ) : null}

      {lightbox ? (
        <button
          type="button"
          className="invite-ukt__lightbox"
          aria-label="Tutup pratinjau"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Pratinjau galeri" decoding="async" />
        </button>
      ) : null}
    </div>
  );
}
