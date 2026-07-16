"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MemberPageHeader } from "@/components/member/MemberPageHeader";
import { EventGateModal } from "@/components/member/EventGateModal";
import type { EventGateReason } from "@/lib/memberCompleteness";
import { showError, showSuccess } from "@/lib/client-toast";

type Category = { id: string; name: string; fee: number };

export function EventRegisterClient({
  event,
  gateReason,
  alreadyRegistered,
}: {
  event: {
    id: string;
    title: string;
    description: string | null;
    startDate: string;
    endDate: string | null;
    location: string | null;
    categories: Category[];
  };
  gateReason: EventGateReason;
  alreadyRegistered: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [modalReason, setModalReason] = useState<EventGateReason>(null);
  const [categoryId, setCategoryId] = useState(event.categories[0]?.id ?? "");

  async function handleRegister() {
    if (gateReason) {
      setModalReason(gateReason);
      return;
    }
    setLoading(true);
    const res = await fetch("/api/member/events/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: event.id,
        categoryId: categoryId || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      if (data.gate) {
        setModalReason(data.gate as EventGateReason);
        return;
      }
      showError(data.error || "Gagal mendaftar");
      return;
    }

    showSuccess("Berhasil mendaftar kegiatan");
    router.refresh();
  }

  return (
    <>
      <MemberPageHeader title="Detail Kegiatan" backHref="/dashboard/kegiatan" />
      <div className="member-fade-in space-y-4">
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <h2 className="text-lg font-extrabold">{event.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {new Date(event.startDate).toLocaleString("id-ID")}
            {event.endDate
              ? ` — ${new Date(event.endDate).toLocaleString("id-ID")}`
              : ""}
          </p>
          {event.location ? (
            <p className="mt-1 text-sm text-muted-foreground">{event.location}</p>
          ) : null}
          {event.description ? (
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
              {event.description}
            </p>
          ) : null}
        </div>

        {event.categories.length > 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="mb-2 text-sm font-semibold">Kategori</p>
            <div className="space-y-2">
              {event.categories.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 p-3 has-[:checked]:border-inkai-red has-[:checked]:bg-inkai-red/5"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="category"
                      value={c.id}
                      checked={categoryId === c.id}
                      onChange={() => setCategoryId(c.id)}
                      className="accent-[var(--inkai-red)]"
                    />
                    {c.name}
                  </span>
                  <span className="text-sm font-semibold">
                    Rp {c.fee.toLocaleString("id-ID")}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {alreadyRegistered ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            Anda sudah terdaftar di kegiatan ini.
          </div>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={handleRegister}
            className="w-full rounded-xl bg-inkai-red py-3.5 text-sm font-bold text-white hover:bg-inkai-red/90 disabled:opacity-60"
          >
            {loading ? "Mendaftar..." : "Daftar Kegiatan"}
          </button>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Lihat{" "}
          <Link href="/dashboard/iuran" className="text-inkai-red font-medium">
            status iuran
          </Link>{" "}
          sebelum mendaftar.
        </p>
      </div>

      <EventGateModal
        reason={modalReason}
        onClose={() => setModalReason(null)}
      />
    </>
  );
}
