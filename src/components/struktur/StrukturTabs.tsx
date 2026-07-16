"use client";

import Link from "next/link";
import type { PublicBranchStructure } from "@/lib/public-data";
import type { PengurusPeriod } from "@/lib/struktur-pengurus";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SusunanPengurus from "@/components/struktur/SusunanPengurus";
import { Users } from "lucide-react";

type StrukturTabsProps = {
  branch: PublicBranchStructure | null;
  pengurus: PengurusPeriod;
};

export default function StrukturTabs({ branch, pengurus }: StrukturTabsProps) {
  return (
    <Tabs defaultValue="organisasi" className="gap-6">
      <TabsList className="h-auto w-full rounded-xl bg-muted p-1">
        <TabsTrigger
          value="organisasi"
          className="flex-1 rounded-lg py-2.5 text-sm font-medium data-active:shadow-sm"
        >
          Organisasi
        </TabsTrigger>
        <TabsTrigger
          value="dojo"
          className="flex-1 rounded-lg py-2.5 text-sm font-medium data-active:shadow-sm"
        >
          Dojo / Ranting
        </TabsTrigger>
      </TabsList>

      <TabsContent value="organisasi" className="mt-0 space-y-4">
        <div className="flex justify-end print:hidden">
          <Link
            href={`/struktur/print?period=${pengurus.id}`}
            className="text-sm font-medium text-inkai-red hover:underline"
          >
            Cetak / Export PDF →
          </Link>
        </div>
        <SusunanPengurus pengurus={pengurus} />
      </TabsContent>

      <TabsContent value="dojo" className="mt-0">
        {!branch || branch.dojos.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-muted-foreground">
              Belum ada data dojo/ranting.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-muted-foreground">
                Dojo & Ranting di Surabaya
              </p>
              <Badge variant="secondary">
                {branch.dojos.length} dojo/ranting
              </Badge>
            </div>

            {branch.dojos.map((dojo) => (
              <Card key={dojo.id} className="bg-muted/30">
                <CardContent className="flex items-center gap-3 p-4">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Link
                      href={`/dojo/${dojo.id}`}
                      prefetch
                      className="font-medium hover:text-inkai-red hover:underline"
                    >
                      {dojo.name.trim()}
                    </Link>
                    {dojo.headName && (
                      <p className="text-xs text-muted-foreground">
                        Pelatih/Ketua: {dojo.headName}
                      </p>
                    )}
                    {dojo.address && (
                      <p className="text-xs text-muted-foreground">
                        {dojo.address}
                      </p>
                    )}
                    {dojo.kecamatan && (
                      <p className="text-xs text-muted-foreground">
                        Kec. {dojo.kecamatan}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
