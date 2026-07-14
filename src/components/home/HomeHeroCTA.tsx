"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLoginModal } from "@/components/auth/LoginModal";

export default function HomeHeroCTA() {
  const { openLogin } = useLoginModal();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
      <Button
        asChild
        size="lg"
        className="h-12 rounded-xl bg-inkai-yellow px-8 text-base font-semibold text-inkai-black shadow-lg shadow-inkai-yellow/25 transition-all hover:bg-inkai-yellow/90 hover:shadow-xl hover:shadow-inkai-yellow/30"
      >
        <Link href="/daftar">Daftar Anggota</Link>
      </Button>
      <Button
        type="button"
        size="lg"
        variant="outline"
        className="h-12 rounded-xl border-white/25 bg-white/5 px-8 text-base font-medium text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/15 hover:text-white"
        onClick={openLogin}
      >
        <LogIn className="mr-2 size-4" />
        Login Anggota
      </Button>
      <Button
        asChild
        size="lg"
        variant="outline"
        className="h-12 rounded-xl border-white/25 bg-white/5 px-8 text-base font-medium text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/15 hover:text-white"
      >
        <Link href="/sejarah">Pelajari Sejarah</Link>
      </Button>
    </div>
  );
}
