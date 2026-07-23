"use client";

import Link from "next/link";
import { buildUktInviteLoginUrl, type UktInvitePublic } from "@/lib/ukt-invite";

type RegisterCtaProps = {
  invite: UktInvitePublic;
  className?: string;
};

export function RegisterCta({ invite, className }: RegisterCtaProps) {
  const href = buildUktInviteLoginUrl(invite);
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
      Daftarkan Anggota
    </Link>
  );
}
