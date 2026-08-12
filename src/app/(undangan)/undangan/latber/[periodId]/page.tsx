import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LatberInviteExperience } from "@/components/undangan/latber/LatberInviteExperience";
import { getLatberInvitePublic, buildLatberInviteUrl } from "@/lib/latber-invite";
import { SITE_URL } from "@/lib/site";

type Props = { params: Promise<{ periodId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { periodId } = await params;
  const invite = await getLatberInvitePublic(periodId);
  if (!invite) {
    return { title: "Undangan Latber" };
  }
  const title = `Undangan ${invite.title}`;
  const description =
    "Undangan latihan bersama INKAI Surabaya — segera daftarkan anggota ranting Anda.";
  const url = buildLatberInviteUrl(periodId);

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

export default async function LatberInvitePage({ params }: Props) {
  const { periodId } = await params;
  const invite = await getLatberInvitePublic(periodId);
  if (!invite) notFound();

  return <LatberInviteExperience invite={invite} />;
}
