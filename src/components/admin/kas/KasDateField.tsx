"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { parseFlexibleIdDate } from "@/lib/parse-birth-date";

export function KasDateField({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (ymd: string) => void;
  id?: string;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit(raw: string) {
    const parsed = parseFlexibleIdDate(raw);
    if (parsed) {
      onChange(parsed);
      setDraft(parsed);
      return;
    }
    toast.error("Tanggal tidak dikenali. Contoh: Selasa, 27 Januari 2026");
    setDraft(value);
  }

  return (
    <div className="flex min-w-[12rem] flex-1 gap-1">
      <Input
        id={id}
        type="text"
        value={draft}
        placeholder="Selasa, 27 Januari 2026"
        className="min-w-0 flex-1"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim() === value) return;
          commit(draft);
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (!text.trim()) return;
          e.preventDefault();
          commit(text);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          }
        }}
      />
      <Input
        type="date"
        value={value}
        aria-label="Pilih tanggal"
        className="w-[2.75rem] shrink-0 px-1"
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
      />
    </div>
  );
}
