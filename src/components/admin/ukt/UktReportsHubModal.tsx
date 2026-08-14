"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UktExportDialog } from "@/components/admin/ukt/UktExportDialog";
import { UktAdminReportModal } from "@/components/admin/ukt/UktAdminReportModal";
import { UktHasilUjianPanel } from "@/components/admin/ukt/UktHasilUjianPanel";
import {
  hasUktHasilUjianRecap,
  isUktBillingPaid,
  type BeltFeeKey,
  type UktMemberRow,
  type UktPeriodMeta,
  type UktSemester,
} from "@/lib/ukt";

export type UktReportsHubTab = "peserta" | "hasil" | "administrasi";

type DojoOption = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: UktReportsHubTab;
  eventId: string;
  semester: UktSemester;
  year: number;
  rows: UktMemberRow[];
  dojos: DojoOption[];
  periodMeta?: UktPeriodMeta | null;
  isCabang: boolean;
  isDojoAdmin: boolean;
  lockDojoId?: string;
  initialDojoId?: string;
  notaBeltFees: Record<BeltFeeKey, number>;
  examAt?: string | null;
  examLocation?: string | null;
  sekretariatAddress?: string;
  bidangUjianName?: string;
  orgKetuaCabangName?: string | null;
  strukturKetuaName?: string | null;
  pengprovHeadName?: string | null;
  onPengprovFeesSaved?: (fees: Record<BeltFeeKey, number>) => void;
  onPeriodMetaSaved?: (meta: UktPeriodMeta) => void;
};

export function UktReportsHubModal({
  open,
  onOpenChange,
  defaultTab,
  eventId,
  semester,
  year,
  rows,
  dojos,
  periodMeta,
  isCabang,
  isDojoAdmin,
  lockDojoId,
  initialDojoId,
  notaBeltFees,
  examAt,
  examLocation,
  sekretariatAddress,
  bidangUjianName,
  orgKetuaCabangName,
  strukturKetuaName,
  pengprovHeadName,
  onPengprovFeesSaved,
  onPeriodMetaSaved,
}: Props) {
  const resolvedDefault = useMemo<UktReportsHubTab>(() => {
    if (defaultTab) return defaultTab;
    if (hasUktHasilUjianRecap(rows)) return "hasil";
    return "peserta";
  }, [defaultTab, rows]);

  const [tab, setTab] = useState<UktReportsHubTab>(resolvedDefault);

  const paidRows = useMemo(
    () => rows.filter((r) => r.registrationId && isUktBillingPaid(r)),
    [rows],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) setTab(resolvedDefault);
      }}
    >
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-xl">
        <DialogHeader className="shrink-0 border-b px-3 py-3 sm:px-4">
          <DialogTitle className="text-base">Laporan UKT</DialogTitle>
        </DialogHeader>
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as UktReportsHubTab)}
          className="min-h-0 flex-1 gap-0 overflow-hidden"
        >
          <div className="shrink-0 border-b px-3 py-2 sm:px-4">
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="peserta" className="flex-none px-3">
                Peserta
              </TabsTrigger>
              <TabsTrigger value="hasil" className="flex-none px-3">
                Hasil Ujian
              </TabsTrigger>
              {isCabang ? (
                <TabsTrigger value="administrasi" className="flex-none px-3">
                  Administrasi
                </TabsTrigger>
              ) : null}
            </TabsList>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            <TabsContent value="peserta" className="mt-0">
              <UktExportDialog
                embedded
                rows={rows}
                dojos={dojos}
                semester={semester}
                year={year}
                initialDojoId={initialDojoId}
                lockDojoId={lockDojoId}
                bidangUjianName={bidangUjianName}
                sekretariatAddress={sekretariatAddress}
              />
            </TabsContent>
            <TabsContent value="hasil" className="mt-0">
              <UktHasilUjianPanel
                eventId={eventId}
                semester={semester}
                year={year}
                rows={
                  isDojoAdmin && lockDojoId
                    ? rows.filter((r) => r.dojoId === lockDojoId)
                    : rows
                }
                periodMeta={periodMeta}
                isCabang={isCabang}
                orgKetuaCabangName={orgKetuaCabangName}
                strukturKetuaName={strukturKetuaName}
                pengprovHeadName={pengprovHeadName}
                orgBidangUjianName={bidangUjianName}
                examAt={examAt}
                onMetaSaved={onPeriodMetaSaved}
              />
            </TabsContent>
            {isCabang ? (
              <TabsContent value="administrasi" className="mt-0">
                <UktAdminReportModal
                  embedded
                  eventId={eventId}
                  semester={semester}
                  year={year}
                  rows={paidRows}
                  notaBeltFees={notaBeltFees}
                  periodMeta={periodMeta}
                  examAt={examAt}
                  examLocation={examLocation}
                  sekretariatAddress={sekretariatAddress}
                  onPengprovFeesSaved={onPengprovFeesSaved}
                />
              </TabsContent>
            ) : null}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
