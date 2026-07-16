"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useLoginModal } from "@/components/auth/LoginModal";

export default function LupaPasswordPage() {
  const { openForgotPassword } = useLoginModal();

  useEffect(() => {
    openForgotPassword();
  }, [openForgotPassword]);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <p className="text-sm text-muted-foreground">
        Form lupa password dibuka sebagai popup.
      </p>
      <button
        type="button"
        onClick={openForgotPassword}
        className="rounded-xl bg-inkai-red px-5 py-2.5 text-sm font-semibold text-white hover:bg-inkai-red/90"
      >
        Buka form lupa password
      </button>
      <Link href="/login" className="text-sm text-inkai-red hover:underline">
        Kembali ke login
      </Link>
    </div>
  );
}
