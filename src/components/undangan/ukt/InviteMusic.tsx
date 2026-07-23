"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

type InviteMusicProps = {
  active: boolean;
};

/**
 * Musik ringan: hanya HTMLAudioElement + file mp3.
 * Tanpa Web Audio oscillator (hemat CPU). Jika file kosong/gagal → tombol mute no-op.
 */
export function InviteMusic({ active }: InviteMusicProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    const audio = new Audio("/undangan/ukt/music.mp3");
    audio.loop = true;
    audio.preload = "none";
    audio.volume = 0.3;
    audioRef.current = audio;

    const tryPlay = () => {
      void audio
        .play()
        .then(() => {
          if (cancelled) return;
          // File stub/invalid sering punya duration NaN atau sangat pendek.
          const check = () => {
            if (cancelled) return;
            if (Number.isFinite(audio.duration) && audio.duration >= 1) {
              setAvailable(true);
            } else {
              audio.pause();
              setAvailable(false);
            }
          };
          if (audio.readyState >= 1) check();
          else audio.addEventListener("loadedmetadata", check, { once: true });
        })
        .catch(() => {
          if (!cancelled) setAvailable(false);
        });
    };

    tryPlay();

    return () => {
      cancelled = true;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    };
  }, [active]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  if (!active) return null;

  return (
    <button
      type="button"
      className="invite-ukt__icon-btn"
      aria-label={muted ? "Unmute musik" : "Mute musik"}
      title={available ? undefined : "Tambahkan music.mp3 untuk memutar musik"}
      onClick={() => setMuted((m) => !m)}
    >
      {muted || !available ? (
        <VolumeX className="h-4 w-4" />
      ) : (
        <Volume2 className="h-4 w-4" />
      )}
    </button>
  );
}
