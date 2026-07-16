"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { showError, showSuccess } from "@/lib/client-toast";
import SusunanPengurus from "@/components/struktur/SusunanPengurus";
import {
  emptyBidang,
  emptyPerson,
  emptySeksi,
  listVisiblePeriods,
  moveItem,
  type PersonEntry,
  type PengurusBidang,
  type PengurusPeriod,
  type PengurusStore,
} from "@/lib/struktur-pengurus";
import { FileUploadField } from "@/components/admin/FileUploadField";
import type { PengurusChangeEntry } from "@/lib/pengurus-diff";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Eye,
  FileText,
  GripVertical,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";

type FieldError = { path: string; message: string };

function PersonFields({
  label,
  person,
  onChange,
  pathPrefix,
  fieldErrors,
}: {
  label: string;
  person: PersonEntry;
  onChange: (person: PersonEntry) => void;
  pathPrefix: string;
  fieldErrors: FieldError[];
}) {
  const err = (suffix: string) =>
    fieldErrors.find((f) => f.path === `${pathPrefix}.${suffix}` || f.path === pathPrefix)?.message;

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <Label>{label}</Label>
      <Input
        value={person.name}
        onChange={(e) => onChange({ ...person, name: e.target.value })}
        placeholder="Nama lengkap"
        aria-invalid={Boolean(err("name"))}
      />
      {err("name") && <p className="text-xs text-destructive">{err("name")}</p>}
      <FileUploadField
        label="Foto"
        value={person.photoUrl}
        folder="pengurus/foto"
        accept="image/*"
        onChange={(photoUrl) => onChange({ ...person, photoUrl })}
        hint="Unggah foto atau tempel URL"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={person.phone ?? ""}
          onChange={(e) => onChange({ ...person, phone: e.target.value })}
          placeholder="Telepon"
        />
        <Input
          value={person.email ?? ""}
          onChange={(e) => onChange({ ...person, email: e.target.value })}
          placeholder="Email"
        />
      </div>
      {err("email") && <p className="text-xs text-destructive">{err("email")}</p>}
      {err("photoUrl") && (
        <p className="text-xs text-destructive">{err("photoUrl")}</p>
      )}
    </div>
  );
}

function PersonListEditor({
  label,
  values,
  onChange,
  pathPrefix,
  fieldErrors,
}: {
  label: string;
  values: PersonEntry[];
  onChange: (values: PersonEntry[]) => void;
  pathPrefix: string;
  fieldErrors: FieldError[];
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...values, emptyPerson()])}
        >
          <Plus className="mr-1 h-4 w-4" />
          Tambah
        </Button>
      </div>
      {values.map((person, index) => (
        <div key={index} className="flex gap-2">
          <div className="min-w-0 flex-1">
            <PersonFields
              label={`#${index + 1}`}
              person={person}
              pathPrefix={`${pathPrefix}.${index}`}
              fieldErrors={fieldErrors}
              onChange={(next) => {
                const copy = [...values];
                copy[index] = next;
                onChange(copy);
              }}
            />
          </div>
          <div className="flex flex-col gap-1 pt-6">
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => onChange(moveItem(values, index, index - 1))}
              aria-label="Naik"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => onChange(moveItem(values, index, index + 1))}
              aria-label="Turun"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => onChange(values.filter((_, i) => i !== index))}
              aria-label="Hapus"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function BidangEditor({
  bidang,
  index,
  total,
  onChange,
  onMove,
  onRemove,
  fieldErrors,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  bidang: PengurusBidang;
  index: number;
  total: number;
  onChange: (bidang: PengurusBidang) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  fieldErrors: FieldError[];
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}) {
  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="cursor-grab active:cursor-grabbing"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="flex items-start gap-2">
          <GripVertical className="mt-1 h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">{bidang.title || `Bidang ${index + 1}`}</CardTitle>
        </div>
        <div className="flex gap-1">
          <Button type="button" size="icon" variant="outline" disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="outline" disabled={index >= total - 1} onClick={() => onMove(1)}>
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button type="button" size="icon" variant="outline" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Nama bidang / seksi</Label>
          <Input
            value={bidang.title}
            onChange={(e) => onChange({ ...bidang, title: e.target.value })}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {bidang.head === undefined ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onChange({ ...bidang, head: emptyPerson() })}
            >
              + Koordinator bidang
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange({ ...bidang, head: undefined })}
            >
              Hapus koordinator
            </Button>
          )}
          {bidang.members === undefined ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onChange({ ...bidang, members: [emptyPerson()] })}
            >
              + Daftar anggota
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onChange({
                ...bidang,
                seksi: [...(bidang.seksi ?? []), emptySeksi()],
              })
            }
          >
            + Seksi
          </Button>
        </div>

        {bidang.head && (
          <PersonFields
            label="Koordinator / Ketua bidang"
            person={bidang.head}
            pathPrefix={`bidang.${index}.head`}
            fieldErrors={fieldErrors}
            onChange={(head) => onChange({ ...bidang, head })}
          />
        )}

        {bidang.members && (
          <PersonListEditor
            label="Anggota bidang"
            values={bidang.members}
            pathPrefix={`bidang.${index}.members`}
            fieldErrors={fieldErrors}
            onChange={(members) => onChange({ ...bidang, members })}
          />
        )}

        {bidang.seksi?.map((seksi, seksiIndex) => (
          <div
            key={seksi.id}
            className="rounded-lg border border-inkai-yellow/30 bg-muted/20 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <Input
                value={seksi.title}
                onChange={(e) => {
                  const next = [...(bidang.seksi ?? [])];
                  next[seksiIndex] = { ...seksi, title: e.target.value };
                  onChange({ ...bidang, seksi: next });
                }}
                placeholder="Nama seksi"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() =>
                  onChange({
                    ...bidang,
                    seksi: (bidang.seksi ?? []).filter((_, i) => i !== seksiIndex),
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <PersonListEditor
              label="Anggota seksi"
              values={seksi.members}
              pathPrefix={`bidang.${index}.seksi.${seksiIndex}.members`}
              fieldErrors={fieldErrors}
              onChange={(members) => {
                const next = [...(bidang.seksi ?? [])];
                next[seksiIndex] = { ...seksi, members };
                onChange({ ...bidang, seksi: next });
              }}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function PengurusEditor({
  initialStore,
  canEdit,
  initialHistory = [],
  branchHeadName = null,
}: {
  initialStore: PengurusStore;
  canEdit: boolean;
  initialHistory?: PengurusChangeEntry[];
  branchHeadName?: string | null;
}) {
  const router = useRouter();
  const [store, setStore] = useState(initialStore);
  const [history, setHistory] = useState(initialHistory);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const periods = useMemo(() => listVisiblePeriods(store), [store]);
  const deleted = useMemo(
    () => store.periods.filter((p) => p.isDeleted),
    [store],
  );
  const [selectedId, setSelectedId] = useState(
    () => periods.find((p) => p.isActive)?.id ?? periods[0]?.id ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [newPeriodeLabel, setNewPeriodeLabel] = useState("");

  const draft = store.periods.find((p) => p.id === selectedId) ?? periods[0];
  const ketuaMismatch =
    Boolean(branchHeadName?.trim()) &&
    Boolean(draft?.inti.ketua.name) &&
    branchHeadName!.trim() !== draft.inti.ketua.name.trim();

  function updateDraft(next: PengurusPeriod) {
    setStore((prev) => ({
      periods: prev.periods.map((p) => (p.id === next.id ? next : p)),
    }));
  }

  async function api(body: Record<string, unknown>) {
    setLoading(true);
    setFieldErrors([]);
    const res = await fetch("/api/admin/organisasi/pengurus", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      if (Array.isArray(data.fields)) setFieldErrors(data.fields);
      showError(data.error || "Gagal memproses");
      return null;
    }

    if (data.store) setStore(data.store);
    if (Array.isArray(data.history)) setHistory(data.history);
    showSuccess(data.message || "Berhasil");
    if (data.syncKetua && data.syncKetua.ok === false) {
      showError(`Sinkron ketua cabang: ${data.syncKetua.error || "gagal"}`);
    } else if (data.syncKetua?.ok) {
      showSuccess("Ketua cabang ikut diselaraskan");
    }
    router.refresh();
    return data;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || !draft) return;
    await api({
      action: "save",
      period: { ...draft, updatedAt: new Date().toISOString() },
      syncKetua: true,
    });
  }

  if (!draft) {
    return <p className="text-muted-foreground">Belum ada data pengurus.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-inkai-red/20 bg-inkai-red/5 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-medium">Susunan Pengurus Kota</p>
          <p className="text-sm text-muted-foreground">
            Edit, arsipkan periode, unggah tautan SK, preview, dan export PDF.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/struktur" target="_blank">
              Halaman publik
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={`/struktur/print?period=${draft.id}&autoprint=1`} target="_blank">
              <Printer className="mr-2 h-4 w-4" />
              Cetak / PDF
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPreview((v) => !v)}
          >
            <Eye className="mr-2 h-4 w-4" />
            {showPreview ? "Sembunyikan preview" : "Preview"}
          </Button>
        </div>
      </div>

      {ketuaMismatch && canEdit && (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            Ketua di susunan pengurus berbeda dengan ketua cabang (
            <span className="font-medium">{branchHeadName}</span>).
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            className="gap-1.5"
            onClick={() => api({ action: "pullKetuaFromBranch" })}
          >
            <RefreshCw className="h-4 w-4" />
            Tarik dari cabang
          </Button>
        </div>
      )}

      {!canEdit && (
        <p className="rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
          Anda hanya dapat melihat. Hubungi admin cabang untuk mengubah data.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-3">
          <p className="text-sm font-semibold">Periode</p>
          <div className="space-y-2">
            {periods.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  p.id === draft.id
                    ? "border-inkai-red/40 bg-inkai-red/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{p.periode}</span>
                  {p.isActive && <Badge className="bg-inkai-red text-white">Aktif</Badge>}
                </div>
                {p.archivedAt && !p.isActive && (
                  <p className="mt-1 text-xs text-muted-foreground">Arsip</p>
                )}
              </button>
            ))}
          </div>

          {canEdit && (
            <div className="space-y-2 rounded-lg border p-3">
              <Label>Periode baru</Label>
              <Input
                value={newPeriodeLabel}
                onChange={(e) => setNewPeriodeLabel(e.target.value)}
                placeholder="mis. 2030 – 2034"
              />
              <Button
                type="button"
                size="sm"
                className="w-full"
                disabled={loading || !newPeriodeLabel.trim()}
                onClick={async () => {
                  const data = await api({
                    action: "create",
                    periode: newPeriodeLabel.trim(),
                    sourcePeriodId: draft.id,
                  });
                  if (data?.createdId) {
                    setSelectedId(data.createdId);
                    setNewPeriodeLabel("");
                  }
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                Duplikasi periode
              </Button>
            </div>
          )}

          {deleted.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Terhapus
              </p>
              {deleted.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 text-sm"
                >
                  <span>{p.periode}</span>
                  {canEdit && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={loading}
                      onClick={() => api({ action: "restore", periodId: p.id })}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>

        <form onSubmit={handleSave} className="space-y-6">
          {fieldErrors.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p className="mb-2 font-medium text-destructive">Perbaiki field berikut:</p>
              <ul className="list-inside list-disc space-y-1 text-destructive">
                {fieldErrors.map((f) => (
                  <li key={`${f.path}-${f.message}`}>
                    <span className="font-mono text-xs">{f.path}</span>: {f.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <fieldset disabled={!canEdit} className="space-y-6 disabled:opacity-80">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Label periode</Label>
                <Input
                  value={draft.periode}
                  onChange={(e) =>
                    updateDraft({ ...draft, periode: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Pelindung</Label>
                <Input
                  value={draft.pelindung}
                  onChange={(e) =>
                    updateDraft({ ...draft, pelindung: e.target.value })
                  }
                />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  Dokumen SK / Lampiran
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Judul dokumen</Label>
                  <Input
                    value={draft.document?.title ?? ""}
                    onChange={(e) =>
                      updateDraft({
                        ...draft,
                        document: { ...draft.document, title: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nomor surat</Label>
                  <Input
                    value={draft.document?.number ?? ""}
                    onChange={(e) =>
                      updateDraft({
                        ...draft,
                        document: { ...draft.document, number: e.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tanggal</Label>
                  <Input
                    value={draft.document?.date ?? ""}
                    onChange={(e) =>
                      updateDraft({
                        ...draft,
                        document: { ...draft.document, date: e.target.value },
                      })
                    }
                    placeholder="11 Februari 2026"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <FileUploadField
                    label="Dokumen SK (PDF/gambar)"
                    value={draft.document?.url}
                    folder="pengurus/sk"
                    accept="application/pdf,image/*"
                    hint="Unggah file atau tempel URL publik. Butuh BLOB_READ_WRITE_TOKEN di environment."
                    onChange={(url) =>
                      updateDraft({
                        ...draft,
                        document: { ...draft.document, url },
                      })
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <PersonListEditor
              label="Penasihat"
              values={draft.penasihat}
              pathPrefix="penasihat"
              fieldErrors={fieldErrors}
              onChange={(penasihat) => updateDraft({ ...draft, penasihat })}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pengurus Inti</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(
                  [
                    ["Ketua", "ketua"],
                    ["Koordinator MSH", "koordinatorMsh"],
                    ["Wakil Ketua", "wakilKetua"],
                    ["Sekretaris", "sekretaris"],
                    ["Bendahara", "bendahara"],
                  ] as const
                ).map(([label, key]) => (
                  <PersonFields
                    key={key}
                    label={label}
                    person={draft.inti[key]}
                    pathPrefix={`inti.${key}`}
                    fieldErrors={fieldErrors}
                    onChange={(person) =>
                      updateDraft({
                        ...draft,
                        inti: { ...draft.inti, [key]: person },
                      })
                    }
                  />
                ))}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">Bidang & Seksi</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateDraft({
                      ...draft,
                      bidang: [...draft.bidang, emptyBidang()],
                    })
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Tambah bidang
                </Button>
              </div>
              {draft.bidang.map((bidang, index) => (
                <BidangEditor
                  key={bidang.id}
                  bidang={bidang}
                  index={index}
                  total={draft.bidang.length}
                  fieldErrors={fieldErrors}
                  onChange={(next) => {
                    const bidangList = [...draft.bidang];
                    bidangList[index] = next;
                    updateDraft({ ...draft, bidang: bidangList });
                  }}
                  onMove={(dir) =>
                    updateDraft({
                      ...draft,
                      bidang: moveItem(draft.bidang, index, index + dir),
                    })
                  }
                  onRemove={() =>
                    updateDraft({
                      ...draft,
                      bidang: draft.bidang.filter((_, i) => i !== index),
                    })
                  }
                  onDragStart={() => setDragFrom(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragFrom === null || dragFrom === index) return;
                    updateDraft({
                      ...draft,
                      bidang: moveItem(draft.bidang, dragFrom, index),
                    });
                    setDragFrom(null);
                  }}
                />
              ))}
            </div>
          </fieldset>

          {canEdit && (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="bg-inkai-red hover:bg-inkai-red/90"
              >
                {loading ? "Menyimpan..." : "Simpan periode ini"}
              </Button>
              {!draft.isActive && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={() =>
                    api({
                      action: "activate",
                      periodId: draft.id,
                      syncKetua: true,
                    })
                  }
                >
                  Jadikan aktif
                </Button>
              )}
              {draft.isActive === false && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={() => api({ action: "archive", periodId: draft.id })}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Arsipkan
                </Button>
              )}
              {!draft.isActive && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={loading}
                  onClick={() => {
                    if (confirm("Soft-delete periode ini? Bisa dipulihkan nanti.")) {
                      api({ action: "delete", periodId: draft.id });
                    }
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Hapus
                </Button>
              )}
            </div>
          )}
        </form>
      </div>

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riwayat perubahan</CardTitle>
          </CardHeader>
          <CardContent className="max-h-72 space-y-3 overflow-y-auto">
            {history.slice(0, 20).map((h) => (
              <div key={h.id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{h.action}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.at).toLocaleString("id-ID")}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {h.byEmail} · {h.periodeLabel} · {h.summary}
                </p>
                {h.changes.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {h.changes.slice(0, 5).map((c) => (
                      <li key={`${h.id}-${c.path}`}>
                        <span className="font-mono">{c.path}</span>:{" "}
                        <span className="line-through opacity-70">{c.from || "—"}</span>{" "}
                        → {c.to || "—"}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {showPreview && (
        <div className="rounded-2xl border bg-background p-4 sm:p-6">
          <p className="mb-4 text-sm font-semibold text-muted-foreground">
            Preview tampilan publik
          </p>
          <SusunanPengurus pengurus={draft} showPrintHint />
        </div>
      )}
    </div>
  );
}
