import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { canStartImpersonation } from "@/lib/security/impersonation";
import { getPrimaryAdminRole, ROLE_LABELS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export type RoleTargetUser = {
  id: string;
  email: string;
  fullName: string | null;
  primaryRole: string;
  roleLabel: string;
  scopeName: string;
  isCurrent: boolean;
};

export type RoleTargetsGrouped = {
  pp: RoleTargetUser[];
  pengprov: RoleTargetUser[];
  cabang: RoleTargetUser[];
  ranting: RoleTargetUser[];
};

export async function GET() {
  const authResult = await requireAdmin();
  if ("error" in authResult) return authResult.error;

  if (!canStartImpersonation(authResult.user.roles)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        roles: {
          some: {
            name: {
              in: [
                "ADMINISTRATOR",
                "ADMIN_PUSAT",
                "ADMIN_PROVINCE",
                "ADMIN_BRANCH",
                "ADMIN_DOJO",
                "ADMIN",
              ],
            },
          },
        },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        roles: { select: { name: true } },
        managedProvince: { select: { name: true } },
        managedBranch: { select: { name: true } },
        managedDojo: { select: { name: true } },
      },
      orderBy: { fullName: "asc" },
      take: 200,
    });

    const grouped: RoleTargetsGrouped = {
      pp: [],
      pengprov: [],
      cabang: [],
      ranting: [],
    };

    for (const u of users) {
      const primaryRole = getPrimaryAdminRole(u.roles.map((r) => r.name));
      const roleLabel = ROLE_LABELS[primaryRole] || primaryRole;
      const scopeName =
        u.managedDojo?.name ||
        u.managedBranch?.name ||
        u.managedProvince?.name ||
        "Seluruh Wilayah";

      const item: RoleTargetUser = {
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        primaryRole,
        roleLabel,
        scopeName,
        isCurrent: u.id === authResult.user.id,
      };

      if (primaryRole === "ADMINISTRATOR" || primaryRole === "ADMIN_PUSAT" || primaryRole === "ADMIN") {
        grouped.pp.push(item);
      } else if (primaryRole === "ADMIN_PROVINCE") {
        grouped.pengprov.push(item);
      } else if (primaryRole === "ADMIN_BRANCH") {
        grouped.cabang.push(item);
      } else if (primaryRole === "ADMIN_DOJO") {
        grouped.ranting.push(item);
      }
    }

    return NextResponse.json({
      success: true,
      currentUserId: authResult.user.id,
      currentUserRole: getPrimaryAdminRole(authResult.user.roles),
      grouped,
    });
  } catch (error) {
    console.error("[role-targets]", error);
    return NextResponse.json(
      { error: "Gagal memuat target pengurus" },
      { status: 500 },
    );
  }
}
