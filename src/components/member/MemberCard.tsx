"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield } from "lucide-react";

interface MemberCardProps {
  nia: string;
  name: string;
  dojo: string;
  highestBelt?: string;
  qrValue?: string;
}

type ProfilePayload = {
  nia?: string;
  fullName?: string;
  belt?: string | null;
  dojo?: string;
};

export function MemberCard({
  nia: initialNia,
  name: initialName,
  dojo: initialDojo,
  highestBelt: initialBelt,
  qrValue,
}: MemberCardProps) {
  const [nia, setNia] = useState(initialNia);
  const [name, setName] = useState(initialName);
  const [dojo, setDojo] = useState(initialDojo);
  const [belt, setBelt] = useState(initialBelt?.trim() || "—");

  useEffect(() => {
    setNia(initialNia);
    setName(initialName);
    setDojo(initialDojo);
    setBelt(initialBelt?.trim() || "—");
  }, [initialNia, initialName, initialDojo, initialBelt]);

  const refreshCard = useCallback(async () => {
    try {
      const res = await fetch("/api/member/profile", { cache: "no-store" });
      if (!res.ok) return;

      const data = (await res.json()) as ProfilePayload;
      if (data.fullName) setName(data.fullName);
      if (data.nia) setNia(data.nia);
      if (data.dojo) setDojo(data.dojo);
      if (data.belt) setBelt(data.belt);
    } catch {
      // Tetap tampilkan data SSR awal jika refresh gagal.
    }
  }, []);

  useEffect(() => {
    refreshCard();

    const onVisible = () => {
      if (document.visibilityState === "visible") refreshCard();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refreshCard);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshCard();
    }, 15_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refreshCard);
      window.clearInterval(interval);
    };
  }, [refreshCard]);

  const qrSrc = qrValue
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(qrValue)}`
    : null;

  return (
    <div className="member-fade-in relative min-h-[220px] w-full overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-secondary/40 to-card shadow-[0_10px_30px_rgba(200,16,46,0.12)] dark:from-[#20222b] dark:via-[#292c37] dark:to-[#1b1c24] dark:shadow-[0_10px_30px_rgba(200,16,46,0.18)]">
      <Shield
        className="pointer-events-none absolute -right-5 -bottom-5 text-foreground/[0.03]"
        size={150}
      />

      <div className="relative z-[2] flex h-full justify-between gap-3 p-6">
        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-inkai.png"
              alt="Logo INKAI"
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg object-contain"
            />
            <span className="text-xs font-extrabold tracking-[1.5px] text-muted-foreground">
              KARTU ANGGOTA
            </span>
          </div>

          <div className="mt-6 flex flex-col gap-0.5">
            <h1 className="m-0 text-lg font-extrabold uppercase tracking-wide text-foreground">
              {name}
            </h1>
            <h2 className="m-0 text-base font-bold tracking-wide text-inkai-red">
              {nia}
            </h2>
            <p className="m-0 mt-1 text-[13px] font-semibold text-foreground/80">
              {belt}
            </p>
            <p className="m-0 text-xs font-medium text-muted-foreground">{dojo}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center">
          <div className="rounded-2xl bg-white p-2 shadow-sm">
            {qrSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrSrc}
                alt={`QR ${nia}`}
                width={100}
                height={100}
                className="h-[100px] w-[100px]"
              />
            ) : (
              <div className="h-[100px] w-[100px] animate-pulse rounded-lg bg-muted" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
