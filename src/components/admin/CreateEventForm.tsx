"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/lib/client-toast";
import { Loader2, Plus } from "lucide-react";

export function CreateEventForm({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [categoryName, setCategoryName] = useState("Umum");
  const [fee, setFee] = useState("0");

  if (!canCreate) return null;

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          location,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate || startDate).toISOString(),
          categoryName,
          fee: Number(fee) || 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || "Gagal membuat event");
        return;
      }
      showSuccess(data.message || "Event dibuat");
      setOpen(false);
      setTitle("");
      setDescription("");
      setLocation("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6">
      {!open ? (
        <Button
          className="bg-inkai-red hover:bg-inkai-red/90"
          onClick={() => setOpen(true)}
        >
          <Plus className="mr-1 h-4 w-4" /> Buat Event
        </Button>
      ) : (
        <div className="grid gap-2 rounded-xl border p-4 md:grid-cols-2">
          <Input
            className="md:col-span-2"
            placeholder="Judul event (Gashuku, pertandingan, dll.)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            className="md:col-span-2"
            placeholder="Deskripsi"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Input
            placeholder="Lokasi"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <Input
            placeholder="Kategori"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
          />
          <Input
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Biaya (Rp)"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
          <div className="flex gap-2 md:col-span-2">
            <Button
              className="bg-inkai-red hover:bg-inkai-red/90"
              disabled={busy || !title || !startDate}
              onClick={() => void submit()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan Event"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
