"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  MemberAttendanceSheet,
  type MemberAttendanceProgress,
} from "@/components/admin/MemberAttendanceSheet";
import { attendanceProgressLabel } from "@/lib/ukt";
import { cn } from "@/lib/utils";

export function AdminAbsensiProgressTable({
  rows,
  semesterLabel,
}: {
  rows: MemberAttendanceProgress[];
  semesterLabel: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Nama</th>
              <th className="px-3 py-2.5 font-semibold">NIA</th>
              <th className="px-3 py-2.5 font-semibold">Dojo</th>
              <th className="px-3 py-2.5 font-semibold">Hadir</th>
              <th className="px-3 py-2.5 font-semibold">%</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  Belum ada data progress.
                </td>
              </tr>
            ) : (
              rows.map((m) => {
                const progress = attendanceProgressLabel(m.pct);
                return (
                  <tr
                    key={m.id}
                    tabIndex={0}
                    role="button"
                    className="cursor-pointer border-b border-border/40 hover:bg-muted/40 focus-visible:bg-muted/50 focus-visible:outline-none"
                    onClick={() => setSelectedId(m.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(m.id);
                      }
                    }}
                  >
                    <td className="px-3 py-2.5 font-medium">{m.fullName}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {m.nia || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {m.dojo}
                    </td>
                    <td className="px-3 py-2.5">
                      {m.count}/48
                    </td>
                    <td className="px-3 py-2.5 font-semibold">{m.pct}%</td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          progress.tone === "green"
                            ? "border-emerald-500/40 text-emerald-700"
                            : progress.tone === "amber"
                              ? "border-amber-500/40 text-amber-800"
                              : "border-inkai-red/40 text-inkai-red",
                        )}
                      >
                        {progress.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <MemberAttendanceSheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        member={selected}
        semesterLabel={semesterLabel}
      />
    </>
  );
}
