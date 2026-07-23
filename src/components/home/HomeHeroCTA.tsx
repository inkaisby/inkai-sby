"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLoginModal } from "@/components/auth/LoginModal";

export default function HomeHeroCTA() {
  const { openLogin } = useLoginModal();

  return (
    <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
      <Button
        asChild
        size="lg"
        className="h-11 w-full rounded-xl bg-inkai-yellow px-7 text-sm font-semibold text-inkai-black shadow-lg shadow-inkai-yellow/25 transition-all hover:bg-inkai-yellow/90 hover:shadow-xl hover:shadow-inkai-yellow/30 sm:h-12 sm:w-auto sm:text-base"
      >
        <Link href="/daftar">Daftar Anggota</Link>
      </Button>
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="h-11 w-full rounded-xl border-white/20 bg-white/5 px-7 text-sm font-medium text-white backdrop-blur-sm transition-all hover:border-white/35 hover:bg-white/12 hover:text-white sm:h-12 sm:w-auto sm:text-base"
        onClick={openLogin}
      >
        <LogIn className="mr-2 size-4" />
        Login Anggota
      </Button>
      <Button
        asChild
        size="lg"
        variant="outline"
        className="h-11 w-full rounded-xl border-white/20 bg-white/5 px-7 text-sm font-medium text-white backdrop-blur-sm transition-all hover:border-white/35 hover:bg-white/12 hover:text-white sm:h-12 sm:w-auto sm:text-base"
      >
        <Link href="/sejarah">Pelajari Sejarah</Link>
      </Button>
    </div>
  );
}
