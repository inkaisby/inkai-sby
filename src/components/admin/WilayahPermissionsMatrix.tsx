"use client";

import { useState } from "react";
import {
  WILAYAH_COLUMN_LABELS,
  WILAYAH_MATRIX,
  type WilayahColumn,
} from "@/lib/wilayah-rbac";
import { ChevronDown } from "lucide-react";

const COLUMNS: WilayahColumn[] = ["USER", "RANTING", "CABANG", "PENGPROV"];

export function WilayahPermissionsMatrix({
  defaultOpen = false,
}: {
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between border-b bg-muted/40 px-4 py-3 text-left"
      >
        <div>
          <h3 className="text-sm font-bold tracking-wide uppercase">
            Aturan akses wilayah
          </h3>
          <p className="text-xs text-muted-foreground">
            Matriks User → Ranting → Cabang → Pengprov
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="w-40 px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                  Area
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground"
                  >
                    {WILAYAH_COLUMN_LABELS[col]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WILAYAH_MATRIX.map((row) => (
                <tr key={row.id} className="border-b last:border-0 align-top">
                  <td className="px-3 py-3 font-semibold text-foreground">
                    {row.label}
                  </td>
                  {COLUMNS.map((col) => (
                    <td
                      key={col}
                      className="px-3 py-3 text-xs leading-relaxed text-muted-foreground"
                    >
                      {row.cells[col]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
