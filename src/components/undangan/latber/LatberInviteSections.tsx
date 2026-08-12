"use client";

import { useEffect, useRef, useState } from "react";
import type { LatberInvitePublic } from "@/lib/latber-invite";
import { formatLatberCurrency } from "@/lib/latber";
import { LatberRegisterCta } from "./RegisterCta";

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

function formatDeadline(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InviteCountdown({
  targetIso,
  active,
}: {
  targetIso: string | null;
  active: boolean;
}) {
  const daysRef = useRef<HTMLElement>(null);
  const hoursRef = useRef<HTMLElement>(null);
  const minsRef = useRef<HTMLElement>(null);
  const secsRef = useRef<HTMLElement>(null);
  const [expired, setExpired] = useState(() => {
    if (!targetIso) return true;
    const t = new Date(targetIso).getTime();
    return !Number.isFinite(t) || t <= Date.now();
  });

  useEffect(() => {
    if (!targetIso || !active || expired) return;
    const target = new Date(targetIso).getTime();
    if (!Number.isFinite(target)) return;

    const paint = () => {
      const diff = Math.max(0, target - Date.now());
      if (diff <= 0) {
        setExpired(true);
        return false;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      if (daysRef.current) daysRef.current.textContent = pad(days);
      if (hoursRef.current) hoursRef.current.textContent = pad(hours);
      if (minsRef.current) minsRef.current.textContent = pad(mins);
      if (secsRef.current) secsRef.current.textContent = pad(secs);
      return true;
    };

    paint();
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      if (!paint()) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [targetIso, active, expired]);

  if (!targetIso) return null;
  if (expired) {
    return (
      <p className="mt-4 text-center text-sm font-medium text-[color:var(--invite-red)]">
        Pendaftaran telah ditutup.
      </p>
    );
  }

  return (
    <>
      <p className="mt-4 text-center text-xs font-medium text-[color:var(--invite-muted)]">
        Batas pendaftaran · {formatDeadline(targetIso)}
      </p>
      <div className="invite-ukt__countdown" aria-live="off">
        <div className="invite-ukt__countdown-cell">
          <strong ref={daysRef}>--</strong>
          <span>Hari</span>
        </div>
        <div className="invite-ukt__countdown-cell">
          <strong ref={hoursRef}>--</strong>
          <span>Jam</span>
        </div>
        <div className="invite-ukt__countdown-cell">
          <strong ref={minsRef}>--</strong>
          <span>Menit</span>
        </div>
        <div className="invite-ukt__countdown-cell">
          <strong ref={secsRef}>--</strong>
          <span>Detik</span>
        </div>
      </div>
    </>
  );
}

export function LatberHomeTab({
  invite,
  active,
}: {
  invite: LatberInvitePublic;
  active: boolean;
}) {
  return (
    <section className="invite-ukt__section" data-tab="home">
      <div className="invite-ukt__hero-copy">
        <p className="invite-ukt__eyebrow">INKAI Surabaya</p>
        <h1 className="invite-ukt__title">{invite.title}</h1>
        <p className="invite-ukt__lead">
          Latihan bersama anggota INKAI Cabang Surabaya. Daftarkan anggota ranting
          melalui portal admin.
        </p>
        <p className="mt-2 text-sm text-[color:var(--invite-muted)]">
          Biaya peserta {formatLatberCurrency(invite.feeAmount)} (informasi internal
          ranting).
        </p>
        <InviteCountdown targetIso={invite.registrationCloseAt} active={active} />
        <LatberRegisterCta invite={invite} className="mt-6" />
      </div>
    </section>
  );
}

export function LatberAcaraTab({ invite }: { invite: LatberInvitePublic }) {
  return (
    <section className="invite-ukt__section" data-tab="acara">
      <h2 className="invite-ukt__section-title">Jadwal Latihan Bersama</h2>
      <ul className="invite-ukt__detail-list">
        {invite.eventAt && (
          <li>
            <span>Waktu latihan</span>
            <strong>{formatDeadline(invite.eventAt)}</strong>
          </li>
        )}
        {invite.eventLocation && (
          <li>
            <span>Lokasi</span>
            <strong>{invite.eventLocation}</strong>
          </li>
        )}
        {invite.registrationCloseAt && (
          <li>
            <span>Batas daftar</span>
            <strong>{formatDeadline(invite.registrationCloseAt)}</strong>
          </li>
        )}
      </ul>
      <LatberRegisterCta invite={invite} className="mt-6" />
    </section>
  );
}

export function LatberMapTab({ invite }: { invite: LatberInvitePublic }) {
  const loc = invite.eventLocation?.trim();
  const embed = loc
    ? `https://maps.google.com/maps?q=${encodeURIComponent(loc)}&output=embed`
    : null;

  return (
    <section className="invite-ukt__section" data-tab="peta">
      <h2 className="invite-ukt__section-title">Peta lokasi</h2>
      <p className="text-sm text-[color:var(--invite-muted)]">
        {loc || "Lokasi latihan menyusul."}
      </p>
      {embed ? (
        <iframe
          title="Peta lokasi latber"
          className="invite-ukt__map mt-4"
          src={embed}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <div className="invite-ukt__map mt-4 grid place-items-center text-sm text-[color:var(--invite-muted)]">
          Peta akan tampil setelah lokasi diisi cabang.
        </div>
      )}
      {invite.mapsUrl ? (
        <a
          href={invite.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-semibold text-[color:var(--invite-red)] underline"
        >
          Buka di Google Maps
        </a>
      ) : null}
      <LatberRegisterCta invite={invite} className="mt-6" />
    </section>
  );
}
