"use client";

import { formatRp, terbilangId } from "@/lib/terbilang";
import { cn } from "@/lib/utils";

export type KwitansiPreviewData = {
  no: string;
  tanggal: string;
  terimaDari: string;
  jumlah: number;
  untukPembayaran: string;
  penerimaName?: string;
  penyetorName?: string;
  penerimaSignUrl?: string | null;
  penyetorSignUrl?: string | null;
  penerimaLabel?: string;
};

type Props = {
  data: KwitansiPreviewData;
  className?: string;
};

export function KwitansiPreview({ data, className }: Props) {
  const terbilang = data.jumlah > 0 ? terbilangId(data.jumlah) : "—";
  const rp = data.jumlah > 0 ? formatRp(data.jumlah) : "—";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-zinc-800 bg-white text-zinc-900 shadow-sm",
        className,
      )}
    >
      <div className="flex min-h-0 flex-col md:flex-row">
        <aside className="border-b border-dashed border-zinc-500 p-3 text-[11px] leading-relaxed md:w-[32%] md:border-b-0 md:border-r">
          <div className="mb-2 flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-inkai.png" alt="INKAI" className="h-5 w-5 object-contain" />
            <div>
              <p className="text-xs font-bold tracking-wide">KWITANSI</p>
              <p className="text-[9px] font-semibold text-zinc-500">INKAI SURABAYA</p>
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
            {data.untukPembayaran || "—"}
          </p>
        </aside>

        <section className="flex-1 p-4">
          <div className="relative mb-3 flex min-h-[44px] items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-inkai.png"
              alt="INKAI"
              className="absolute left-0 top-1/2 h-10 w-10 -translate-y-1/2 object-contain"
            />
            <div className="text-center">
              <h2 className="text-base font-bold tracking-[0.06em] sm:text-lg">
                KWITANSI PEMBAYARAN
              </h2>
              <p className="text-[10px] font-semibold text-zinc-600">
                INSTITUT KARATE-DO INDONESIA (INKAI) CABANG SURABAYA
              </p>
            </div>
          </div>
          <div className="mb-2 flex justify-between gap-3 text-sm">
            <span>No. {data.no || "—"}</span>
            <span>Tanggal: {data.tanggal || "—"}</span>
          </div>
          <div className="mb-2 flex items-end gap-2 text-sm">
            <span className="shrink-0">Sudah terima dari</span>
            <span className="min-w-0 flex-1 border-b border-dotted border-zinc-500 pb-0.5">
              {data.terimaDari || "\u00a0"}
            </span>
          </div>
          <p className="mb-2 text-sm italic text-zinc-700">
            Terbilang: {terbilang}
          </p>
          <div className="mb-3 flex items-end gap-2 text-sm">
            <span className="shrink-0">Untuk pembayaran</span>
            <span className="min-w-0 flex-1 border-b border-dotted border-zinc-500 pb-0.5">
              {data.untukPembayaran || "\u00a0"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="inline-block -skew-x-[8deg] border-2 border-zinc-900 px-4 py-1.5 text-base font-bold">
              <span className="inline-block skew-x-[8deg]">
                RP. {data.jumlah > 0 ? rp.replace(/^Rp\s?/, "") : "—"}
              </span>
            </div>
            <div className="-rotate-6 rounded border-2 border-emerald-700 px-2.5 py-0.5 font-sans text-xs font-extrabold tracking-widest text-emerald-700">
              LUNAS
            </div>
          </div>

          <div className="mt-6 flex justify-between gap-6">
            <div className="w-[42%] text-center text-xs">
              <div className="flex min-h-24 items-end justify-center rounded-sm bg-white">
                {data.penerimaSignUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.penerimaSignUrl}
                    alt="TTD Penerima"
                    className="max-h-24 max-w-[200px] object-contain"
                  />
                ) : null}
              </div>
              <div className="mt-1 border-t border-zinc-700 pt-1">
                {data.penerimaName || "………………"}
              </div>
              <div>{data.penerimaLabel || "Penerima"}</div>
            </div>
            <div className="w-[42%] text-center text-xs">
              <div className="flex min-h-24 items-end justify-center rounded-sm bg-white">
                {data.penyetorSignUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.penyetorSignUrl}
                    alt="TTD Penyetor"
                    className="max-h-24 max-w-[200px] object-contain"
                  />
                ) : null}
              </div>
              <div className="mt-1 border-t border-zinc-700 pt-1">
                {data.penyetorName || "………………"}
              </div>
              <div>Penyetor</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
