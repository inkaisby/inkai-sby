"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  ADMIN_DOJO_GRANT_PRESETS,
  ADMIN_DOJO_SIDEBAR_OPTIONS,
  DEFAULT_ADMIN_DOJO_GRANTS,
  type AdminDojoGrants,
} from "@/lib/admin-dojo-grants";

export function AdminDojoGrantsEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: AdminDojoGrants;
  onChange: (next: AdminDojoGrants) => void;
  disabled?: boolean;
}) {
  const allSidebarPaths = useMemo(
    () => ADMIN_DOJO_SIDEBAR_OPTIONS.map((o) => o.path),
    [],
  );

  function toggleSidebar(path: string, checked: boolean) {
    const set = new Set(value.sidebarPaths);
    if (checked) set.add(path);
    else set.delete(path);
    const next = [...set];
    onChange({
      ...value,
      sidebarPaths: next.length ? next : ["/admin"],
    });
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Hak akses admin ranting
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Centang kemampuan yang diberikan ke akun ini di ranting ini.
        </p>
      </div>

      <div className="space-y-1">
        <Label className="text-sm font-medium">Preset cepat</Label>
        <div className="flex flex-wrap gap-1.5">
          {ADMIN_DOJO_GRANT_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={disabled}
              onClick={() =>
                onChange({
                  editProfile: preset.grants.editProfile,
                  crud: preset.grants.crud,
                  sidebarPaths: [...preset.grants.sidebarPaths],
                })
              }
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={value.editProfile}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...value, editProfile: e.target.checked })
            }
          />
          <span>
            <span className="font-medium">Edit profil anggota</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Dokumen, iuran/bln, pengecualian iuran di detail anggota
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={value.crud}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, crud: e.target.checked })}
          />
          <span>
            <span className="font-medium">CRUD anggota</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Tambah anggota, nonaktif/aktif, arsip/hapus, bulk
            </span>
          </span>
        </label>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label className="text-sm font-medium">Menu sidebar admin</Label>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={disabled}
              onClick={() =>
                onChange({ ...value, sidebarPaths: [...allSidebarPaths] })
              }
            >
              Centang semua
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={disabled}
              onClick={() => onChange({ ...value, sidebarPaths: ["/admin"] })}
            >
              Minimal
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={disabled}
              onClick={() =>
                onChange({
                  ...value,
                  sidebarPaths: [...DEFAULT_ADMIN_DOJO_GRANTS.sidebarPaths],
                })
              }
            >
              Reset
            </Button>
          </div>
        </div>
        <div className="grid max-h-44 grid-cols-1 gap-1.5 overflow-y-auto rounded-md border bg-background p-2 sm:grid-cols-2">
          {ADMIN_DOJO_SIDEBAR_OPTIONS.map((opt) => (
            <label
              key={opt.path}
              className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted/60"
            >
              <input
                type="checkbox"
                checked={value.sidebarPaths.includes(opt.path)}
                disabled={disabled}
                onChange={(e) => toggleSidebar(opt.path, e.target.checked)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
