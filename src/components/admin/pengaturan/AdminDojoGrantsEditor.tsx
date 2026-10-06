"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ADMIN_DOJO_GRANT_PRESETS,
  ADMIN_DOJO_SIDEBAR_OPTIONS,
  DEFAULT_ADMIN_DOJO_GRANTS,
  type AdminDojoGrants,
  type CrudPermission,
} from "@/lib/admin-dojo-grants";
import { ShieldCheck, CheckSquare, Sparkles, Eye, Plus, Edit3, Trash2 } from "lucide-react";

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

  const crudPermissions = value.crudPermissions || {};

  function toggleSidebar(path: string, checked: boolean) {
    const set = new Set(value.sidebarPaths);
    if (checked) set.add(path);
    else set.delete(path);
    const nextPaths = [...set];

    const nextPerms = { ...crudPermissions };
    if (checked && !nextPerms[path]) {
      nextPerms[path] = { read: true, create: value.crud, update: value.crud, delete: value.crud };
    } else if (!checked) {
      delete nextPerms[path];
    }

    onChange({
      ...value,
      sidebarPaths: nextPaths,
      crudPermissions: nextPerms,
    });
  }

  function toggleCrudField(path: string, field: keyof CrudPermission, checked: boolean) {
    const isSidebarChecked = value.sidebarPaths.includes(path);
    const set = new Set(value.sidebarPaths);
    if (checked || field === "read") {
      set.add(path); // Auto-enable sidebar path if any CRUD permission is checked
    }

    const currentPerm = crudPermissions[path] || {
      read: isSidebarChecked,
      create: value.crud,
      update: value.crud,
      delete: value.crud,
    };

    const updatedPerm: CrudPermission = {
      ...currentPerm,
      [field]: checked,
    };

    // If read is unchecked, uncheck all CRUD permissions
    if (field === "read" && !checked) {
      updatedPerm.create = false;
      updatedPerm.update = false;
      updatedPerm.delete = false;
    }

    const nextPerms = {
      ...crudPermissions,
      [path]: updatedPerm,
    };

    onChange({
      ...value,
      sidebarPaths: [...set],
      crudPermissions: nextPerms,
    });
  }

  function toggleAllField(field: keyof CrudPermission, checked: boolean) {
    const nextPerms: Record<string, CrudPermission> = { ...crudPermissions };
    const set = new Set(value.sidebarPaths);

    for (const option of ADMIN_DOJO_SIDEBAR_OPTIONS) {
      const path = option.path;
      if (checked) set.add(path);
      const current = nextPerms[path] || { read: true, create: true, update: true, delete: true };
      nextPerms[path] = {
        ...current,
        [field]: checked,
      };
      if (field === "read" && !checked) {
        nextPerms[path] = { read: false, create: false, update: false, delete: false };
      }
    }

    onChange({
      ...value,
      sidebarPaths: [...set],
      crudPermissions: nextPerms,
    });
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-inkai-red" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Pengaturan Hak Akses & Matriks Izin CRUD Pengurus
            </h4>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Centang menu yang diizinkan tampil di sidebar serta atur hak akses spesifik **Read (Lihat)**, **Create (Tambah)**, **Update (Ubah)**, dan **Delete (Hapus)**.
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] border-inkai-red/30 text-inkai-red">
          {value.sidebarPaths.length} Menu Aktif
        </Badge>
      </div>

      {/* Preset Buttons */}
      <div className="space-y-1.5 bg-muted/20 p-2.5 rounded-xl border">
        <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-amber-500" />
          <span>Preset Cepat Hak Akses Bidang:</span>
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {ADMIN_DOJO_GRANT_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs rounded-lg hover:border-inkai-red hover:text-inkai-red transition-all"
              disabled={disabled}
              onClick={() =>
                onChange({
                  editProfile: preset.grants.editProfile,
                  crud: preset.grants.crud,
                  sidebarPaths: [...preset.grants.sidebarPaths],
                  crudPermissions: preset.grants.crudPermissions ? { ...preset.grants.crudPermissions } : {},
                })
              }
            >
              {preset.label}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
            disabled={disabled}
            onClick={() =>
              onChange({
                editProfile: true,
                crud: false,
                sidebarPaths: ["/admin"],
                crudPermissions: {},
              })
            }
          >
            🧹 Kosongkan
          </Button>
        </div>
      </div>

      {/* Profile & Global CRUD Master Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border bg-muted/10 text-xs">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            className="mt-0.5 rounded border-gray-300 text-inkai-red focus:ring-inkai-red"
            checked={value.editProfile}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...value, editProfile: e.target.checked })
            }
          />
          <span>
            <span className="font-semibold text-foreground">Edit Profil Anggota</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              Dokumen, iuran/bln, dan pengecualian iuran di detail anggota.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            className="mt-0.5 rounded border-gray-300 text-inkai-red focus:ring-inkai-red"
            checked={value.crud}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, crud: e.target.checked })}
          />
          <span>
            <span className="font-semibold text-foreground">Master Full CRUD Default</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              Izinkan Tambah, Ubah, dan Hapus secara umum pada modul aktif.
            </span>
          </span>
        </label>
      </div>

      {/* Granular CRUD & Sidebar Menu Permission Matrix Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-bold text-foreground uppercase tracking-wider">
            Matriks Hak Akses Sidebar & Izin CRUD Modul
          </Label>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>Centang Master:</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => toggleAllField("read", true)}
              className="text-emerald-600 hover:underline font-semibold"
            >
              Semua Lihat
            </button>
            <span>•</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => toggleAllField("create", true)}
              className="text-blue-600 hover:underline font-semibold"
            >
              Semua Tambah
            </button>
            <span>•</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => toggleAllField("update", true)}
              className="text-amber-600 hover:underline font-semibold"
            >
              Semua Ubah
            </button>
            <span>•</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => toggleAllField("delete", true)}
              className="text-rose-600 hover:underline font-semibold"
            >
              Semua Hapus
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-background">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b text-[11px] font-semibold text-muted-foreground uppercase">
                <th className="p-2.5 pl-3">Menu Sidebar Modul</th>
                <th className="p-2.5 text-center w-24">Sidebar</th>
                <th className="p-2.5 text-center w-20 text-emerald-700 dark:text-emerald-400">
                  <div className="flex items-center justify-center gap-1">
                    <Eye className="h-3 w-3" />
                    <span>Lihat (R)</span>
                  </div>
                </th>
                <th className="p-2.5 text-center w-20 text-blue-700 dark:text-blue-400">
                  <div className="flex items-center justify-center gap-1">
                    <Plus className="h-3 w-3" />
                    <span>Tambah (C)</span>
                  </div>
                </th>
                <th className="p-2.5 text-center w-20 text-amber-700 dark:text-amber-400">
                  <div className="flex items-center justify-center gap-1">
                    <Edit3 className="h-3 w-3" />
                    <span>Ubah (U)</span>
                  </div>
                </th>
                <th className="p-2.5 text-center w-20 text-rose-700 dark:text-rose-400">
                  <div className="flex items-center justify-center gap-1">
                    <Trash2 className="h-3 w-3" />
                    <span>Hapus (D)</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {ADMIN_DOJO_SIDEBAR_OPTIONS.map((option) => {
                const path = option.path;
                const isSidebarChecked = value.sidebarPaths.includes(path);
                const perm = crudPermissions[path] || {
                  read: isSidebarChecked,
                  create: isSidebarChecked && value.crud,
                  update: isSidebarChecked && value.crud,
                  delete: isSidebarChecked && value.crud,
                };

                return (
                  <tr
                    key={path}
                    className={`transition-colors ${
                      isSidebarChecked ? "bg-muted/20" : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    <td className="p-2.5 pl-3 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{option.label}</span>
                        <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {path}
                        </code>
                      </div>
                    </td>

                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={isSidebarChecked}
                        onChange={(e) => toggleSidebar(path, e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-inkai-red focus:ring-inkai-red"
                      />
                    </td>

                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={perm.read}
                        onChange={(e) => toggleCrudField(path, "read", e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </td>

                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        disabled={disabled || !perm.read}
                        checked={perm.create}
                        onChange={(e) => toggleCrudField(path, "create", e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>

                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        disabled={disabled || !perm.read}
                        checked={perm.update}
                        onChange={(e) => toggleCrudField(path, "update", e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      />
                    </td>

                    <td className="p-2.5 text-center">
                      <input
                        type="checkbox"
                        disabled={disabled || !perm.read}
                        checked={perm.delete}
                        onChange={(e) => toggleCrudField(path, "delete", e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
