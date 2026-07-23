import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UktInviteExperience } from "@/components/undangan/ukt/UktInviteExperience";
import { getUktInvitePublic, buildUktInviteUrl } from "@/lib/ukt-invite";
import { SITE_URL } from "@/lib/site";

type Props = { params: Promise<{ periodId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { periodId } = await params;
  const invite = await getUktInvitePublic(periodId);
  if (!invite) {
    return { title: "Undangan UKT" };
  }
  const title = `Undangan ${invite.title}`;
  const description =
    "Undangan resmi Ujian Kenaikan Tingkat INKAI Surabaya — segera daftarkan anggota ranting Anda.";
  const url = buildUktInviteUrl(periodId);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "website",
      locale: "id_ID",
      images: [
        {
          url: `${SITE_URL}/logo-inkai.png`,
          width: 512,
          height: 512,
          alt: "INKAI Surabaya",
        },
      ],
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function UktInvitePage({ params }: Props) {
  const { periodId } = await params;
  const invite = await getUktInvitePublic(periodId);
  if (!invite) notFound();

  return <UktInviteExperience invite={invite} />;
}
