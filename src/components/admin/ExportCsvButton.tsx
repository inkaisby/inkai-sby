"use client";

import { Button } from "@/components/ui/button";
import { triggerCsvDownload } from "@/lib/ukt";
import { Download } from "lucide-react";

export function ExportCsvButton({
  filename,
  headers,
  rows,
  label = "Export CSV",
}: {
  filename: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
  label?: string;
}) {
  function download() {
    const escape = (v: string | number | null | undefined) => {
      const s = String(v ?? "");
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [
      headers.map(escape).join(","),
      ...rows.map((r) => r.map(escape).join(",")),
    ];
    triggerCsvDownload(filename, `\uFEFF${lines.join("\n")}`);
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={download} className="gap-1">
      <Download className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
