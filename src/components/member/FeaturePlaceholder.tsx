"use client";

import Link from "next/link";
import { Construction } from "lucide-react";
import { MemberPageHeader } from "@/components/member/MemberPageHeader";

export function FeaturePlaceholder({ title }: { title: string }) {
  return (
    <>
      <MemberPageHeader title={title} />
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-inkai-red/10 text-inkai-red">
          <Construction size={32} />
        </div>
        <h2 className="mb-2 text-lg font-extrabold">Fitur Segera Hadir</h2>
        <p className="mb-6 max-w-sm text-sm text-muted-foreground">
          Halaman <strong>{title}</strong> sedang dalam tahap sinkronisasi.
          Mohon tunggu pembaruan selanjutnya.
        </p>
        <Link
          href="/dashboard"
          className="rounded-xl bg-inkai-red px-5 py-2.5 text-sm font-semibold text-white hover:bg-inkai-red/90"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </>
  );
}
