"use client";

import { useState } from "react";
import { ChevronDown, Download, FileText, MessageSquare, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { AdminMemberRow } from "@/lib/inkai-api/admin-data";
import {
  copyTextRobust,
  downloadAnggotaCsv,
  downloadAnggotaRosterPdf,
  fetchAnggotaExportMembers,
  formatAnggotaWaLines,
  printAnggotaRosterDocument,
  type AnggotaExportFilterParams,
} from "@/lib/anggota-export";

export function AnggotaExportMenu({
  exportParams,
  total,
  dojoName,
}: {
  exportParams: AnggotaExportFilterParams;
  total: number;
  dojoName?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function loadExportRows(): Promise<AdminMemberRow[]> {
    setLoading(true);
    try {
      return await fetchAnggotaExportMembers(exportParams);
    } finally {
      setLoading(false);
    }
  }

  async function handleCsv() {
    try {
      const rows = await loadExportRows();
      if (rows.length === 0) {
        toast.error("Tidak ada anggota untuk diekspor");
        return;
      }
      downloadAnggotaCsv(rows);
      toast.success(`${rows.length} anggota diunduh sebagai CSV`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal export CSV");
    }
  }

  async function handleWa() {
    try {
      const rows = await loadExportRows();
      if (rows.length === 0) {
        toast.error("Tidak ada anggota untuk disalin");
        return;
      }
      const text = formatAnggotaWaLines(rows);
      const ok = await copyTextRobust(text);
      if (ok) {
        toast.success(`${rows.length} baris disalin — tempel di WhatsApp`);
      } else {
        toast.error("Gagal menyalin — salin manual dari pratinjau");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal salin WA");
    }
  }

  async function handlePrint() {
    try {
      const rows = await loadExportRows();
      if (rows.length === 0) {
        toast.error("Tidak ada anggota untuk dicetak");
        return;
      }
      printAnggotaRosterDocument(rows, { dojoName });
      toast.success(`${rows.length} anggota siap dicetak`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal cetak");
    }
  }

  async function handlePdf() {
    try {
      const rows = await loadExportRows();
      if (rows.length === 0) {
        toast.error("Tidak ada anggota untuk diunduh PDF");
        return;
      }
      await downloadAnggotaRosterPdf(rows, "anggota-roster.pdf", { dojoName });
      toast.success(`${rows.length} anggota diunduh sebagai PDF`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal unduh PDF");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading || total <= 0}
          className="gap-1"
        >
          <Download className="h-3.5 w-3.5" />
          {loading ? "Memuat…" : "Export"}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuItem onClick={() => void handleCsv()} disabled={loading}>
          <Download className="mr-2 h-4 w-4" />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handlePdf()} disabled={loading}>
          <FileText className="mr-2 h-4 w-4" />
          PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handlePrint()} disabled={loading}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void handleWa()} disabled={loading}>
          <MessageSquare className="mr-2 h-4 w-4" />
          WA
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
