"use client";

import { formatRp, terbilangId } from "@/lib/terbilang";
import {
  formatUntukPembayaran,
  type KwitansiPrintLayout,
} from "@/lib/kwitansi-print-html";
import { cn } from "@/lib/utils";

export type KwitansiPreviewData = {
  no: string;
  tanggal: string;
  terimaDari: string;
  jumlah: number;
  untukPembayaran: string;
  eventLabel?: string;
  kegiatan?: string;
  penerimaName?: string;
  penyetorName?: string;
  penerimaSignUrl?: string | null;
  penyetorSignUrl?: string | null;
  penerimaLabel?: string;
};

type Props = {
  data: KwitansiPreviewData;
  layout?: KwitansiPrintLayout;
  showCutLine?: boolean;
  className?: string;
};

export function KwitansiPreview({
  data,
  layout = "f4-4",
  showCutLine,
  className,
}: Props) {
  const terbilang = data.jumlah > 0 ? terbilangId(data.jumlah) : "—";
  const rp = data.jumlah > 0 ? formatRp(data.jumlah) : "—";

  const eventText = data.eventLabel || data.kegiatan || "";
  const untukPembayaranText = formatUntukPembayaran(data.untukPembayaran, eventText);
  const isF45 = layout === "f4-5";
  const isF44 = layout === "f4-4";
  const isF43 = layout === "f4-3";
  const isCompact = isF45 || isF44 || isF43;

  const layoutBadgeLabel =
    layout === "f4-4"
      ? "F4 Portrait (Muat 4 Kwitansi)"
      : layout === "f4-5"
      ? "F4 Portrait (Muat 5 Kwitansi)"
      : layout === "f4-3"
      ? "F4 Portrait (Muat 3 Kwitansi)"
      : layout === "f4-2"
      ? "F4 Portrait (Muat 2 Kwitansi)"
      : layout === "portrait-1"
      ? "Portrait (1 Lembar)"
      : "Landscape (A4 Klasik)";

  return (
    <div className="space-y-1.5">
      {/* Header Info Layout Cetak */}
      <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          Format Dokumen Kwitansi Resmi
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-zinc-200/80 px-2 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          <span>📄</span>
          <span>{layoutBadgeLabel}</span>
        </span>
      </div>

      <div
        className={cn(
          "overflow-hidden rounded-lg border border-zinc-800 bg-white text-zinc-900 shadow-sm",
          className,
        )}
      >
        <div className="flex min-h-0 flex-col md:flex-row">
          <aside
            className={cn(
              "border-b border-dashed border-zinc-500 leading-relaxed md:border-b-0 md:border-r bg-zinc-50/50",
              isF45
                ? "p-2 text-[9.5px] md:w-[28%]"
                : isCompact
                ? "p-2.5 text-[10px] md:w-[30%]"
                : "p-3 text-[11px] md:w-[32%]",
            )}
          >
            <div className="mb-2 flex items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-inkai.png"
                alt="INKAI"
                className={cn("object-contain", isCompact ? "h-4 w-4" : "h-5 w-5")}
              />
              <div>
                <p className="text-xs font-bold tracking-wide">KWITANSI</p>
                <p className="text-[9px] font-semibold text-zinc-500">
                  INKAI SURABAYA
                </p>
              </div>
            </div>
            <p>No. {data.no || "—"}</p>
            <p>Tanggal: {data.tanggal || "—"}</p>
            <p className="mt-2">
              Terima dari:
              <br />
              <strong>{data.terimaDari || "—"}</strong>
            </p>
            <p className="mt-2">
              Jumlah: <strong>{rp}</strong>
            </p>
            <p className="mt-1 text-zinc-600">{terbilang}</p>
            <p className="mt-2">
              Untuk pembayaran:
              <br />
              {untukPembayaranText}
            </p>
          </aside>

          <section
            className={cn(
              "flex-1",
              isF45 ? "p-2.5" : isCompact ? "p-3" : "p-4",
            )}
          >
            <div
              className={cn(
                "relative flex items-center justify-center",
                isF45
                  ? "mb-1.5 min-h-[30px]"
                  : isCompact
                  ? "mb-2 min-h-[36px]"
                  : "mb-3 min-h-[44px]",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-inkai.png"
                alt="INKAI"
                className={cn(
                  "absolute left-0 top-1/2 -translate-y-1/2 object-contain",
                  isF45 ? "h-6 w-6" : isCompact ? "h-7 w-7" : "h-10 w-10",
                )}
              />
              <div className="text-center">
                <h2
                  className={cn(
                    "font-bold tracking-[0.06em]",
                    isF45
                      ? "text-xs sm:text-sm"
                      : isCompact
                      ? "text-sm sm:text-base"
                      : "text-base sm:text-lg",
                  )}
                >
                  KWITANSI PEMBAYARAN
                </h2>
                <p
                  className={cn(
                    "font-semibold text-zinc-600",
                    isCompact ? "text-[8.5px]" : "text-[10px]",
                  )}
                >
                  INSTITUT KARATE-DO INDONESIA (INKAI) CABANG SURABAYA
                </p>
              </div>
            </div>
            <div
              className={cn(
                "mb-2 flex justify-between gap-3",
                isCompact ? "text-xs" : "text-sm",
              )}
            >
              <span>No. {data.no || "—"}</span>
              <span>Tanggal: {data.tanggal || "—"}</span>
            </div>
            <div
              className={cn(
                "mb-2 flex items-end gap-2",
                isCompact ? "text-xs" : "text-sm",
              )}
            >
              <span className="shrink-0">Sudah terima dari</span>
              <span className="min-w-0 flex-1 border-b border-dotted border-zinc-500 pb-0.5">
                {data.terimaDari || "\u00a0"}
              </span>
            </div>
            <p
              className={cn(
                "mb-2 italic text-zinc-700",
                isCompact ? "text-xs" : "text-sm",
              )}
            >
              Terbilang: {terbilang}
            </p>
            <div
              className={cn(
                "mb-3 flex items-end gap-2",
                isCompact ? "text-xs" : "text-sm",
              )}
            >
              <span className="shrink-0">Untuk pembayaran</span>
              <span className="min-w-0 flex-1 border-b border-dotted border-zinc-500 pb-0.5">
                {untukPembayaranText === "—" ? "\u00a0" : untukPembayaranText}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div
                className={cn(
                  "inline-block -skew-x-[8deg] border-2 border-zinc-900 font-bold",
                  isCompact ? "px-3 py-1 text-sm" : "px-4 py-1.5 text-base",
                )}
              >
                <span className="inline-block skew-x-[8deg]">
                  RP. {data.jumlah > 0 ? rp.replace(/^Rp\s?/, "") : "—"}
                </span>
              </div>
              <div
                className={cn(
                  "-rotate-6 rounded border-2 border-emerald-700 font-sans font-extrabold tracking-widest text-emerald-700",
                  isCompact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs",
                )}
              >
                LUNAS
              </div>
            </div>

            <div
              className={cn(
                "flex justify-between gap-6",
                isCompact ? "mt-3" : "mt-6",
              )}
            >
              <div className="w-[44%] text-center text-xs">
                <div
                  className={cn(
                    "flex items-end justify-center rounded-sm bg-white",
                    isF45 ? "min-h-12" : isCompact ? "min-h-14" : "min-h-24",
                  )}
                >
                  {data.penerimaSignUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={data.penerimaSignUrl}
                      alt="TTD Penerima"
                      className={cn(
                        "object-contain",
                        isCompact
                          ? "max-h-14 max-w-[140px]"
                          : "max-h-24 max-w-[200px]",
                      )}
                    />
                  ) : null}
                </div>
                <div className="mt-1 border-t border-zinc-700 pt-1 font-medium">
                  {data.penerimaName || "………………"}
                </div>
                <div className="text-[11px] text-zinc-600">
                  {data.penerimaLabel || "Penerima"}
                </div>
              </div>
              <div className="w-[44%] text-center text-xs">
                <div
                  className={cn(
                    "flex items-end justify-center rounded-sm bg-white",
                    isF45 ? "min-h-12" : isCompact ? "min-h-14" : "min-h-24",
                  )}
                >
                  {data.penyetorSignUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={data.penyetorSignUrl}
                      alt="TTD Penyetor"
                      className={cn(
                        "object-contain",
                        isCompact
                          ? "max-h-14 max-w-[140px]"
                          : "max-h-24 max-w-[200px]",
                      )}
                    />
                  ) : null}
                </div>
                <div className="mt-1 border-t border-zinc-700 pt-1 font-medium">
                  {data.penyetorName || "………………"}
                </div>
                <div className="text-[11px] text-zinc-600">Penyetor</div>
              </div>
            </div>
          </section>
        </div>

        {/* Garis Potong simulasi jika layout portrait/F4 */}
        {(showCutLine || layout !== "landscape") ? (
          <div className="flex items-center justify-center gap-2 border-t border-dashed border-zinc-400 bg-zinc-50/80 px-4 py-1.5 text-[10px] font-semibold text-zinc-500 tracking-wider">
            <span>✂</span>
            <span>GARIS POTONG (KERTAS F4 PORTRAIT)</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
