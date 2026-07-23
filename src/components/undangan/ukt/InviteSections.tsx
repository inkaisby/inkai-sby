"use client";

import { useEffect, useRef, useState } from "react";
import { formatUktRegistrationDeadline } from "@/lib/ukt";
import type { UktInvitePublic } from "@/lib/ukt-invite";
import { RegisterCta } from "./RegisterCta";

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

/** Countdown hemat: tick 1s hanya saat aktif + tab terlihat; update DOM via ref (tanpa setState tiap detik). */
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
        Batas pendaftaran · {formatUktRegistrationDeadline(targetIso)}
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

export function HomeTab({
  invite,
  active,
}: {
  invite: UktInvitePublic;
  active: boolean;
}) {
  return (
    <div className="invite-ukt__panel">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--invite-red)]">
        Undangan resmi
      </p>
      <h2 className="invite-ukt__display mt-2 text-3xl text-[color:var(--invite-ink)]">
        {invite.title}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-[color:var(--invite-muted)]">
        Dengan hormat kami mengundang pengurus ranting INKAI Surabaya untuk segera
        mendaftarkan anggota yang memenuhi syarat pada Ujian Kenaikan Tingkat
        periode ini.
      </p>

      {invite.archived || invite.locked ? (
        <p className="mt-4 text-center text-sm font-medium text-[color:var(--invite-red)]">
          Periode ini sudah diarsipkan.
        </p>
      ) : (
        <InviteCountdown targetIso={invite.registrationCloseAt} active={active} />
      )}

      <RegisterCta invite={invite} />
      <div className="invite-ukt__hint" aria-hidden>
        <span>Geser untuk melihat</span>
        <span>⌄</span>
      </div>
    </div>
  );
}

export function AcaraTab({ invite }: { invite: UktInvitePublic }) {
  return (
    <div className="invite-ukt__panel">
      <div className="invite-ukt__belt-lines mb-3" aria-hidden>
        <span />
        <span />
      </div>
      <h2 className="invite-ukt__display text-3xl">Acara</h2>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-[color:var(--invite-muted)]">
            Buka pendaftaran
          </dt>
          <dd className="mt-0.5 font-medium">
            {invite.registrationOpenAt
              ? formatUktRegistrationDeadline(invite.registrationOpenAt)
              : "Sudah dibuka"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-[color:var(--invite-muted)]">
            Batas pendaftaran
          </dt>
          <dd className="mt-0.5 font-medium">
            {invite.registrationCloseAt
              ? formatUktRegistrationDeadline(invite.registrationCloseAt)
              : "Menyusul"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-[color:var(--invite-muted)]">
            Jadwal ujian
          </dt>
          <dd className="mt-0.5 font-medium">
            {invite.examAt
              ? formatUktRegistrationDeadline(invite.examAt)
              : "Akan diinformasikan"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-[color:var(--invite-muted)]">
            Tempat ujian
          </dt>
          <dd className="mt-0.5 font-medium">
            {invite.examLocation?.trim() || "Lokasi menyusul"}
          </dd>
        </div>
      </dl>
      <RegisterCta invite={invite} />
    </div>
  );
}

const GALLERY = [
  "/undangan/ukt/gallery/1.svg",
  "/undangan/ukt/gallery/2.svg",
  "/undangan/ukt/gallery/3.svg",
  "/undangan/ukt/gallery/4.svg",
  "/undangan/ukt/gallery/5.svg",
  "/undangan/ukt/gallery/6.svg",
];

export function GalleryTab({
  onLightbox,
  onInteract,
}: {
  onLightbox: (src: string | null) => void;
  onInteract: () => void;
}) {
  return (
    <div className="invite-ukt__panel">
      <h2 className="invite-ukt__display text-3xl">Galeri</h2>
      <p className="mt-2 text-sm text-[color:var(--invite-muted)]">
        Jejak kenaikan tingkat — semangat sabuk putih hingga hitam.
      </p>
      <div className="invite-ukt__gallery mt-4">
        {GALLERY.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => {
              onInteract();
              onLightbox(src);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={`Galeri sabuk ${i + 1}`}
              loading="lazy"
              decoding="async"
              width={400}
              height={500}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function MapTab({
  invite,
  mountMap,
}: {
  invite: UktInvitePublic;
  mountMap: boolean;
}) {
  const embed = invite.examLocation?.trim()
    ? `https://maps.google.com/maps?q=${encodeURIComponent(invite.examLocation)}&output=embed`
    : null;

  return (
    <div className="invite-ukt__panel">
      <h2 className="invite-ukt__display text-3xl">Peta lokasi</h2>
      <p className="mt-2 text-sm text-[color:var(--invite-muted)]">
        {invite.examLocation?.trim() || "Lokasi ujian menyusul."}
      </p>
      {embed && mountMap ? (
        <iframe
          title="Peta lokasi ujian UKT"
          className="invite-ukt__map mt-4"
          src={embed}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : embed ? (
        <div className="invite-ukt__map mt-4 grid place-items-center text-sm text-[color:var(--invite-muted)]">
          Gulir ke sini untuk memuat peta…
        </div>
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
      <RegisterCta invite={invite} />
      <p className="mt-3 text-center text-xs leading-relaxed text-[color:var(--invite-muted)]">
        Segera daftarkan anggota ranting Anda sebelum batas waktu berakhir.
      </p>
    </div>
  );
}
