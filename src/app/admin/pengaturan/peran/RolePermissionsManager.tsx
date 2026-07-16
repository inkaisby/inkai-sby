"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/rbac";
import { showError, showSuccess } from "@/lib/client-toast";

type Permission = { id: string; name: string; slug: string };
type RoleRow = {
  id: string;
  name: string;
  permissions: Array<{ permission: Permission }>;
  _count?: { users?: number };
};

export function RolePermissionsManager({
  initialRoles,
  permissions,
}: {
  initialRoles: RoleRow[];
  permissions: Permission[];
}) {
  const router = useRouter();
  const [roles, setRoles] = useState(initialRoles);
  const [selectedId, setSelectedId] = useState(initialRoles[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => roles.find((r) => r.id === selectedId) ?? null,
    [roles, selectedId],
  );

  const selectedPermIds = useMemo(() => {
    if (!selected) return new Set<string>();
    return new Set(selected.permissions.map((p) => p.permission.id));
  }, [selected]);

  function toggle(permId: string) {
    if (!selected) return;
    const nextIds = new Set(selectedPermIds);
    if (nextIds.has(permId)) nextIds.delete(permId);
    else nextIds.add(permId);

    const updated: RoleRow = {
      ...selected,
      permissions: [...nextIds].map((id) => ({
        permission: permissions.find((p) => p.id === id)!,
      })).filter((p) => p.permission),
    };

    setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    const res = await fetch(`/api/admin/pengaturan/roles/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissionIds: [...selectedPermIds] }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      showSuccess(data.message || "Hak akses disimpan");
      router.refresh();
    } else {
      showError(data.error || "Gagal menyimpan");
    }
  }

  if (roles.length === 0) {
    return (
      <p className="rounded-xl border p-8 text-center text-sm text-muted-foreground">
        Belum ada data role.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <div className="space-y-1 rounded-xl border p-2">
        {roles.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => setSelectedId(role.id)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              selectedId === role.id
                ? "bg-inkai-red text-white"
                : "hover:bg-muted"
            }`}
          >
            <span>{ROLE_LABELS[role.name] || role.name}</span>
            <Badge
              variant={selectedId === role.id ? "secondary" : "outline"}
              className="ml-2"
            >
              {role._count?.users ?? 0}
            </Badge>
          </button>
        ))}
      </div>

      <div className="rounded-xl border p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">
              {selected
                ? ROLE_LABELS[selected.name] || selected.name
                : "Pilih role"}
            </h3>
            <p className="text-sm text-muted-foreground">
              Centang permission yang diizinkan untuk role ini
            </p>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || !selected}
            className="bg-inkai-red hover:bg-inkai-red/90"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {permissions.map((perm) => {
            const checked = selectedPermIds.has(perm.id);
            return (
              <label
                key={perm.id}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm transition-colors ${
                  checked ? "border-inkai-red/40 bg-inkai-red/5" : "hover:bg-muted/50"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked}
                  onChange={() => toggle(perm.id)}
                />
                <span>
                  <span className="font-medium">{perm.name}</span>
                  <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                    {perm.slug}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
