"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CreateEventForm } from "@/components/admin/CreateEventForm";
import { EventAdminActions } from "@/components/admin/EventAdminActions";
import { buildUktAdminUrlFromEvent } from "@/lib/ukt";

export type KegiatanEventRow = {
  id: string;
  title: string;
  location: string | null;
  startDate: string;
  endDate: string;
  branchName: string | null;
  registrationCount: number;
};

export function KegiatanBrowser({
  initialEvents,
  canCreate,
}: {
  initialEvents: KegiatanEventRow[];
  canCreate: boolean;
}) {
  const [events, setEvents] = useState(initialEvents);
  const now = Date.now();

  const handleCreated = useCallback((created?: Record<string, unknown> | null) => {
    if (!created || typeof created !== "object") return;
    const id = created.id != null ? String(created.id) : "";
    if (!id) return;
    const branch = created.branch as { name?: string } | undefined;
    const count =
      (created._count as { registrations?: number } | undefined)?.registrations ??
      0;
    setEvents((prev) => [
      {
        id,
        title: String(created.title ?? "Event baru"),
        location:
          created.location != null && created.location !== ""
            ? String(created.location)
            : null,
        startDate: String(created.startDate ?? new Date().toISOString()),
        endDate: String(
          created.endDate ?? created.startDate ?? new Date().toISOString(),
        ),
        branchName: branch?.name ?? null,
        registrationCount: count,
      },
      ...prev.filter((e) => e.id !== id),
    ]);
  }, []);

  const handleChanged = useCallback(
    (eventId: string, patch?: Partial<KegiatanEventRow> | { closed?: true }) => {
      if (patch && "closed" in patch && patch.closed) {
        setEvents((prev) =>
          prev.map((e) =>
            e.id === eventId
              ? { ...e, endDate: new Date().toISOString() }
              : e,
          ),
        );
        return;
      }
      if (patch) {
        setEvents((prev) =>
          prev.map((e) => (e.id === eventId ? { ...e, ...patch } : e)),
        );
      }
    },
    [],
  );

  return (
    <>
      <CreateEventForm canCreate={canCreate} onCreated={handleCreated} />

      {events.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Belum ada event dalam scope Anda.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const isPast = new Date(e.endDate).getTime() < now;
            const isUkt = e.title.toUpperCase().includes("UKT");
            return (
              <Card key={e.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <p className="font-medium">{e.title}</p>
                      <Badge variant={isPast ? "secondary" : "default"}>
                        {isPast ? "Selesai" : "Aktif"}
                      </Badge>
                      {isUkt ? <Badge variant="outline">UKT</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {new Date(e.startDate).toLocaleDateString("id-ID")}
                      {e.endDate
                        ? ` – ${new Date(e.endDate).toLocaleDateString("id-ID")}`
                        : ""}
                      {e.location ? ` · ${e.location}` : ""}
                      {e.branchName ? ` · ${e.branchName}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.registrationCount} pendaftar
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <EventAdminActions
                      eventId={e.id}
                      title={e.title}
                      location={e.location}
                      startDate={e.startDate}
                      endDate={e.endDate}
                      canEdit={canCreate}
                      isUkt={isUkt}
                      onChanged={(patch) => handleChanged(e.id, patch)}
                    />
                    <div className="flex gap-3">
                      {isUkt ? (
                        <Link
                          href={buildUktAdminUrlFromEvent(e.title, e.id)}
                          className="text-sm text-inkai-red hover:underline"
                        >
                          Kelola UKT →
                        </Link>
                      ) : null}
                      <Link
                        href={`/kegiatan/${e.id}`}
                        className="text-sm text-inkai-red hover:underline"
                      >
                        Detail publik →
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
