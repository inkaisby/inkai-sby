"use client";

import Link from "next/link";
import { buildLatberInviteLoginUrl, type LatberInvitePublic } from "@/lib/latber-invite";

type RegisterCtaProps = {
  invite: LatberInvitePublic;
  className?: string;
};

export function LatberRegisterCta({ invite, className }: RegisterCtaProps) {
  const href = buildLatberInviteLoginUrl(invite.periodId);
  const closed = invite.archived || invite.locked || !invite.registrationOpen;

  if (closed) {
    return (
      <span className={`invite-ukt__cta is-disabled ${className ?? ""}`}>
        Pendaftaran ditutup
      </span>
    );
  }

  return (
    <Link href={href} className={`invite-ukt__cta ${className ?? ""}`}>
      Daftar Latihan Bersama
    </Link>
  );
}
