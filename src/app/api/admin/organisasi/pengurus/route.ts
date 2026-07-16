import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { canEditPengurus } from "@/lib/rbac";
import { getClientIp } from "@/lib/security/request";
import {
  activatePeriod,
  archivePeriod,
  createPeriodFrom,
  fetchPengurusStore,
  restorePeriod,
  savePeriod,
  softDeletePeriod,
} from "@/lib/pengurus-settings";
import {
  resolveSurabayaBranch,
  syncKetuaFromBranch,
  syncKetuaToBranch,
} from "@/lib/pengurus-sync";
import { fetchPengurusHistory, recordPengurusChange } from "@/lib/pengurus-history";
import { notifyPengurusUpdate } from "@/lib/pengurus-notify";
import {
  PENGURUS_CACHE_TAG,
  formatPengurusFieldErrors,
  getActivePeriod,
  listVisiblePeriods,
  pengurusPeriodSchema,
  type PengurusPeriod,
} from "@/lib/struktur-pengurus";
import { preparePeriodForSave } from "@/lib/pengurus-prepare";
import { z } from "zod";

function bustCache() {
  revalidateTag(PENGURUS_CACHE_TAG, "max");
  revalidatePath("/struktur");
  revalidatePath("/struktur/print");
  revalidatePath("/admin/organisasi");
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    period: z.unknown(),
    syncKetua: z.boolean().optional().default(true),
  }),
  z.object({
    action: z.literal("activate"),
    periodId: z.string().min(1),
    syncKetua: z.boolean().optional().default(true),
  }),
  z.object({
    action: z.literal("archive"),
    periodId: z.string().min(1),
  }),
  z.object({
    action: z.literal("restore"),
    periodId: z.string().min(1),
  }),
  z.object({
    action: z.literal("delete"),
    periodId: z.string().min(1),
  }),
  z.object({
    action: z.literal("create"),
    periode: z.string().trim().min(4).max(40),
    sourcePeriodId: z.string().optional().nullable(),
  }),
  z.object({
    action: z.literal("pullKetuaFromBranch"),
  }),
]);

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  const [store, history, branch] = await Promise.all([
    fetchPengurusStore(true),
    fetchPengurusHistory(),
    resolveSurabayaBranch(authResult.token!),
  ]);

  return NextResponse.json({
    store,
    periods: listVisiblePeriods(store),
    active: getActivePeriod(store),
    deleted: store.periods.filter((p) => p.isDeleted),
    history,
    branchHeadName: branch?.headName ?? null,
  });
}

export async function PUT(request: Request) {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  if (!canEditPengurus(authResult.user.roles)) {
    return NextResponse.json(
      { error: "Hanya admin cabang ke atas yang dapat mengubah susunan pengurus" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Data tidak valid",
        fields: formatPengurusFieldErrors(parsed.error),
      },
      { status: 400 },
    );
  }

  try {
    let store = await fetchPengurusStore(true);
    let message = "Berhasil";
    let syncResult: { ok: boolean; error?: string } | null = null;
    let createdId: string | undefined;
    let historyEntry = null;
    const payload = parsed.data;
    const actor = authResult.user.email || "admin";

    switch (payload.action) {
      case "save": {
        const periodParsed = pengurusPeriodSchema.safeParse(
          preparePeriodForSave(payload.period as PengurusPeriod),
        );
        if (!periodParsed.success) {
          return NextResponse.json(
            {
              error: "Data periode tidak valid",
              fields: formatPengurusFieldErrors(periodParsed.error),
            },
            { status: 400 },
          );
        }
        const before =
          store.periods.find((p) => p.id === periodParsed.data.id) ?? null;
        store = await savePeriod(periodParsed.data);
        historyEntry = await recordPengurusChange({
          action: "save",
          byEmail: actor,
          before,
          after: periodParsed.data,
        });
        message = "Susunan pengurus berhasil disimpan";
        if (payload.syncKetua && periodParsed.data.isActive) {
          syncResult = await syncKetuaToBranch(
            authResult.token!,
            periodParsed.data.inti.ketua.name,
          );
        }
        void notifyPengurusUpdate({
          token: authResult.token!,
          actorEmail: actor,
          periodeLabel: periodParsed.data.periode,
          summary: historyEntry.summary,
        });
        break;
      }
      case "activate": {
        const before = getActivePeriod(store);
        store = await activatePeriod(payload.periodId);
        const active = getActivePeriod(store);
        historyEntry = await recordPengurusChange({
          action: "activate",
          byEmail: actor,
          before,
          after: active,
        });
        message = "Periode berhasil diaktifkan";
        if (payload.syncKetua) {
          syncResult = await syncKetuaToBranch(
            authResult.token!,
            active.inti.ketua.name,
          );
        }
        void notifyPengurusUpdate({
          token: authResult.token!,
          actorEmail: actor,
          periodeLabel: active.periode,
          summary: `Aktivasi periode ${active.periode}`,
        });
        break;
      }
      case "archive":
        store = await archivePeriod(payload.periodId);
        message = "Periode diarsipkan";
        break;
      case "restore":
        store = await restorePeriod(payload.periodId);
        message = "Periode dipulihkan";
        break;
      case "delete":
        store = await softDeletePeriod(payload.periodId);
        message = "Periode dihapus (soft delete)";
        break;
      case "create": {
        const created = await createPeriodFrom(
          payload.sourcePeriodId ?? null,
          payload.periode,
        );
        store = created.store;
        createdId = created.createdId;
        message = "Periode baru dibuat dari salinan";
        break;
      }
      case "pullKetuaFromBranch": {
        const branch = await resolveSurabayaBranch(authResult.token!);
        if (!branch?.headName) {
          return NextResponse.json(
            { error: "Ketua cabang belum terisi di data organisasi" },
            { status: 400 },
          );
        }
        const before = getActivePeriod(store);
        const pulled = await syncKetuaFromBranch(branch.headName);
        if (!pulled.ok) {
          return NextResponse.json(
            { error: pulled.error || "Gagal menarik ketua dari cabang" },
            { status: 400 },
          );
        }
        store = await fetchPengurusStore(false);
        const after = getActivePeriod(store);
        historyEntry = await recordPengurusChange({
          action: "pullKetuaFromBranch",
          byEmail: actor,
          before,
          after,
        });
        message = pulled.updated
          ? "Ketua pengurus diselaraskan dari data cabang"
          : "Ketua sudah sama dengan data cabang";
        break;
      }
    }

    bustCache();

    writeAuditLog({
      userId: authResult.user.id,
      email: authResult.user.email,
      action: `PENGURUS_${payload.action.toUpperCase()}`,
      details: JSON.stringify({ action: payload.action, historyId: historyEntry?.id }),
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      token: authResult.token,
    });

    const history = await fetchPengurusHistory();

    return NextResponse.json({
      success: true,
      message,
      store,
      periods: listVisiblePeriods(store),
      active: getActivePeriod(store),
      createdId,
      syncKetua: syncResult,
      history,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Data periode tidak valid",
          fields: formatPengurusFieldErrors(error),
        },
        { status: 400 },
      );
    }
    const msg = error instanceof Error ? error.message : "Gagal memproses";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export type { PengurusPeriod };
