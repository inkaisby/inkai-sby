import type { Metadata } from "next";
import { redirect } from "next/navigation";

type Props = { params: Promise<{ periodId: string }> };

export const metadata: Metadata = {
  title: "Latihan Bersama INKAI Surabaya",
  description:
    "Pendaftaran latihan bersama INKAI Surabaya — daftar anggota ranting di portal publik.",
};

export default async function LatberInvitePage({ params }: Props) {
  const { periodId } = await params;
  redirect(`/latber?period=${encodeURIComponent(periodId)}`);
}
