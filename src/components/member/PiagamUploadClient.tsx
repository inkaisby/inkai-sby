"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { showError, showSuccess } from "@/lib/client-toast";
import { ExternalLink, Loader2, Upload } from "lucide-react";

type PiagamItem = {
  id: string;
  status: string;
  data: string;
  proofUrl: string;
  createdAt: string;
  adminNotes: string | null;
};

function parseData(data: string) {
  try {
    return JSON.parse(data) as {
      title?: string;
      eventDate?: string | null;
      notes?: string | null;
    };
  } catch {
    return {};
  }
}

export function PiagamUploadClient({
  items,
  eventItems,
}: {
  items: PiagamItem[];
  eventItems: Array<Record<string, unknown>>;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(file: File) {
    if (title.trim().length < 3) {
      showError("Judul piagam minimal 3 karakter");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("folder", "piagam");
      const up = await fetch("/api/member/upload", { method: "POST", body: form });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok) {
        showError(upData.error || "Gagal mengunggah file");
        return;
      }

      const res = await fetch("/api/member/piagam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          eventDate: eventDate || "",
          notes: notes.trim(),
          proofUrl: upData.url,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal mengirim piagam");
        return;
      }
      showSuccess(data.message || "Piagam terkirim");
      setTitle("");
      setEventDate("");
      setNotes("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
        <p className="text-sm font-semibold">Unggah Piagam / Sertifikat</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Judul piagam"
          className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
        />
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Catatan (opsional)"
          rows={2}
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void submit(file);
            e.target.value = "";
          }}
        />
        <Button
          className="w-full bg-inkai-red hover:bg-inkai-red/90"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" /> Pilih & Kirim File
            </>
          )}
        </Button>
      </div>

      <div>
        <h3 className="mb-3 text-base font-extrabold">Piagam Saya</h3>
        {items.length === 0 && eventItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Belum ada piagam tercatat.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const d = parseData(item.data);
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border/60 bg-card p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{d.title || "Piagam"}</p>
                      <p className="text-sm text-muted-foreground">
                        {d.eventDate
                          ? new Date(d.eventDate).toLocaleDateString("id-ID")
                          : new Date(item.createdAt).toLocaleDateString("id-ID")}
                      </p>
                    </div>
                    <Badge variant="secondary">{item.status}</Badge>
                  </div>
                  {item.proofUrl && item.proofUrl !== "—" ? (
                    <a
                      href={item.proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-inkai-red hover:underline"
                    >
                      Lihat file <ExternalLink size={12} />
                    </a>
                  ) : null}
                </div>
              );
            })}
            {eventItems.map((r) => {
              const event = r.event as
                | { title?: string; startDate?: string }
                | undefined;
              return (
                <div
                  key={String(r.id)}
                  className="rounded-2xl border border-border/60 bg-card p-4"
                >
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="font-semibold">{event?.title ?? "—"}</p>
                      <p className="text-sm text-muted-foreground">
                        {event?.startDate
                          ? new Date(event.startDate).toLocaleDateString("id-ID")
                          : "—"}
                      </p>
                    </div>
                    <Badge variant="secondary">{String(r.status)}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
