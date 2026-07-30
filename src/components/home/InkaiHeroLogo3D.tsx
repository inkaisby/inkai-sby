"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type InkaiHeroLogo3DProps = {
  className?: string;
};

export default function InkaiHeroLogo3D({ className }: InkaiHeroLogo3DProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [canParallax, setCanParallax] = useState(false);

  useEffect(() => {
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqPointer = window.matchMedia("(hover: hover) and (pointer: fine)");

    const sync = () => {
      setReducedMotion(mqMotion.matches);
      setCanParallax(mqPointer.matches && !mqMotion.matches);
    };

    sync();
    mqMotion.addEventListener("change", sync);
    mqPointer.addEventListener("change", sync);
    return () => {
      mqMotion.removeEventListener("change", sync);
      mqPointer.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    const tiltEl = tiltRef.current;
    const stage = stageRef.current;
    if (!canParallax || !tiltEl || !stage) {
      if (tiltEl) tiltEl.style.transform = "";
      return;
    }

    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const tick = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      tiltEl.style.transform = `rotateX(${currentX.toFixed(2)}deg) rotateY(${currentY.toFixed(2)}deg)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onMove = (e: MouseEvent) => {
      const rect = stage.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      targetY = nx * 14;
      targetX = -ny * 10;
    };

    const onLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    stage.addEventListener("mousemove", onMove);
    stage.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      stage.removeEventListener("mousemove", onMove);
      stage.removeEventListener("mouseleave", onLeave);
      tiltEl.style.transform = "";
    };
  }, [canParallax]);

  return (
    <div
      ref={stageRef}
      className={cn(
        "inkai-hero-logo-stage relative order-first flex-shrink-0 lg:order-last",
        className,
      )}
    >
      <div
        className={cn(
          "inkai-hero-logo-glow absolute -inset-8 rounded-full bg-inkai-yellow/15 blur-3xl",
          !reducedMotion && "inkai-hero-logo-glow--pulse",
        )}
        aria-hidden
      />
      <div
        className={cn(
          "inkai-hero-logo-glow-red absolute -inset-2 rounded-full bg-inkai-red/20 blur-xl",
          !reducedMotion && "inkai-hero-logo-glow-red--pulse",
        )}
        aria-hidden
      />

      <div
        className={cn(
          "inkai-hero-logo-float relative",
          !reducedMotion && "inkai-hero-logo-float--animate",
        )}
      >
        <div
          ref={tiltRef}
          className={cn(
            "inkai-hero-logo-tilt",
            !reducedMotion && !canParallax && "inkai-hero-logo-tilt--animate",
          )}
        >
          <div className="relative rounded-full bg-gradient-to-br from-white/25 to-white/5 p-1.5 shadow-2xl ring-1 ring-white/25 backdrop-blur-sm">
            <Image
              src="/logo-inkai.png"
              alt="Logo INKAI"
              width={260}
              height={260}
              className="h-36 w-36 rounded-full sm:h-[220px] sm:w-[220px] lg:h-[260px] lg:w-[260px]"
              priority
            />
            {!reducedMotion && (
              <span className="inkai-hero-logo-shine" aria-hidden />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
