"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  Search,
  Check,
  Building2,
  Landmark,
  Building,
  UserCheck,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ImpersonationRiskModal,
  type ImpersonationRiskModalSubmitInput,
} from "@/components/security/ImpersonationRiskModal";
import type {
  RoleTargetUser,
  RoleTargetsGrouped,
} from "@/app/api/admin/role-targets/route";

export function QuickRoleSwitcher({
  roles = [],
  impersonating = false,
}: {
  roles?: string[];
  impersonating?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"pp" | "pengprov" | "cabang" | "ranting">("ranting");
  const [groupedData, setGroupedData] = useState<RoleTargetsGrouped | null>(null);

  const [selectedTarget, setSelectedTarget] = useState<RoleTargetUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Impersonation feature available for superadmin / branch admin
  const isPusat = roles.some((r) =>
    ["ADMINISTRATOR", "ADMIN_PUSAT", "ADMIN"].includes(r),
  );
  const isBranch = roles.includes("ADMIN_BRANCH");
  const canUseSwitcher = isPusat || isBranch;

  const loadRoleTargets = useCallback(async () => {
    if (!canUseSwitcher) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/role-targets", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.grouped) {
        setGroupedData(json.grouped);
        // Default tab logic: if pp has data prefer pp for superadmin, else ranting
        if (json.grouped.pp?.length && isPusat) {
          setActiveTab("pp");
        } else if (json.grouped.ranting?.length) {
          setActiveTab("ranting");
        }
      }
    } catch (err) {
      console.error("[QuickRoleSwitcher] Load failed", err);
    } finally {
      setLoading(false);
    }
  }, [canUseSwitcher, isPusat]);

  useEffect(() => {
    if (open && !groupedData) {
      void loadRoleTargets();
    }
  }, [open, groupedData, loadRoleTargets]);

  if (!canUseSwitcher) return null;

  const currentTabItems = groupedData ? groupedData[activeTab] || [] : [];
  const filteredItems = currentTabItems.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      item.fullName?.toLowerCase().includes(q) ||
      item.email.toLowerCase().includes(q) ||
      item.scopeName.toLowerCase().includes(q) ||
      item.roleLabel.toLowerCase().includes(q)
    );
  });

  const handleStartImpersonate = async (input: ImpersonationRiskModalSubmitInput) => {
    if (!selectedTarget) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/admin/impersonate/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: selectedTarget.id,
          reason: input.reason,
          password: input.password,
          confirmPhrase: input.confirmPhrase,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Gagal mengambil alih akun");
        return;
      }
      setSelectedTarget(null);
      setOpen(false);
      router.refresh();
      window.location.reload();
    } catch (err) {
      console.error(err);
      setErrorMessage("Terjadi kesalahan koneksi server");
    } finally {
      setSubmitting(false);
    }
  };

  const getTabLabel = (tab: "pp" | "pengprov" | "cabang" | "ranting") => {
    switch (tab) {
      case "pp":
        return { title: "PP (Pusat)", icon: Landmark, count: groupedData?.pp.length || 0 };
      case "pengprov":
        return { title: "Pengprov", icon: Building2, count: groupedData?.pengprov.length || 0 };
      case "cabang":
        return { title: "Cabang", icon: Building, count: groupedData?.cabang.length || 0 };
      case "ranting":
        return { title: "Ranting", icon: UserCheck, count: groupedData?.ranting.length || 0 };
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-1.5 rounded-xl border-border/60 bg-background/80 px-2.5 text-xs font-medium tracking-tight shadow-2xs hover:bg-muted hover:border-inkai-red/30 dark:bg-muted/40"
        title="Pindah Peran & Ambil Alih Sesi Cepat"
      >
        <Zap className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
        <span className="hidden sm:inline">Pindah Peran</span>
        <Badge
          variant="secondary"
          className="h-4 px-1 text-[10px] font-semibold uppercase bg-inkai-red/10 text-inkai-red dark:bg-inkai-red/20"
        >
          {isPusat ? "PP" : "Cabang"}
        </Badge>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0 sm:max-w-2xl flex flex-col">
          <DialogHeader className="p-4 pb-3 border-b border-border/50 bg-gradient-to-r from-inkai-red/5 via-background to-muted/20">
            <div className="flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-inkai-red/10 text-inkai-red">
                <Zap className="size-4" />
              </span>
              <div>
                <DialogTitle className="text-base font-bold">
                  Pintasan Peran & Ambil Alih Sesi
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Simulasi & kelola portal sebagai pengurus PP, Pengprov, Cabang, atau Ranting tanpa logout.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 space-y-3 min-h-0 flex-1 overflow-y-auto">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama pengurus, email, atau nama ranting/dojo…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl"
              />
            </div>

            {/* Level Tabs */}
            <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-muted/60 text-xs font-semibold">
              {(["pp", "pengprov", "cabang", "ranting"] as const).map((tab) => {
                const info = getTabLabel(tab);
                const Icon = info.icon;
                const active = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition-all ${
                      active
                        ? "bg-background text-foreground shadow-xs ring-1 ring-black/5 dark:ring-white/10"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="truncate">{info.title}</span>
                    <Badge variant="outline" className="h-4 px-1 text-[9px] ml-0.5">
                      {info.count}
                    </Badge>
                  </button>
                );
              })}
            </div>

            {/* Target Users List */}
            {loading ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Memuat daftar pengurus…
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                {search ? "Pengurus tidak ditemukan dengan kata kunci ini." : "Tidak ada akun pengurus aktif di kategori ini."}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {filteredItems.map((user) => {
                  const isSelf = user.isCurrent;
                  return (
                    <div
                      key={user.id}
                      className={`flex flex-col justify-between p-3 rounded-xl border transition-all ${
                        isSelf
                          ? "border-emerald-500/40 bg-emerald-500/5"
                          : "border-border/60 bg-card hover:border-inkai-red/40 hover:shadow-xs"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-semibold text-xs truncate">
                            {user.fullName || user.email}
                          </span>
                          {isSelf ? (
                            <Badge className="bg-emerald-600 text-white text-[9px] h-4 px-1.5">
                              Akun Anda
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] h-4 px-1">
                              {user.roleLabel}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate font-mono">
                          {user.email}
                        </p>
                        <div className="flex items-center gap-1 text-[10px] font-medium text-foreground/80">
                          <span className="text-muted-foreground">Wilayah/Scope:</span>
                          <span className="font-semibold text-inkai-red truncate">
                            {user.scopeName}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2.5 mt-2 border-t border-border/40 flex justify-end">
                        {isSelf ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled
                            className="h-7 text-xs text-muted-foreground"
                          >
                            <Check className="h-3 w-3 mr-1 text-emerald-600" />
                            Sesi Aktif
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedTarget(user)}
                            className="h-7 text-xs gap-1 bg-inkai-red/10 text-inkai-red hover:bg-inkai-red hover:text-white transition-colors"
                          >
                            <ShieldAlert className="h-3 w-3" />
                            Ambil Alih Sesi
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedTarget ? (
        <ImpersonationRiskModal
          open={Boolean(selectedTarget)}
          onOpenChange={(next) => {
            if (!next) setSelectedTarget(null);
          }}
          targetName={selectedTarget.fullName || ""}
          targetEmail={selectedTarget.email || ""}
          submitting={submitting}
          errorMessage={errorMessage}
          onSubmit={handleStartImpersonate}
        />
      ) : null}
    </>
  );
}
