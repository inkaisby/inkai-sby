"use client";

import { createContext, useContext, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LoginForm from "@/components/auth/LoginForm";

type LoginModalContextValue = {
  openLogin: () => void;
  closeLogin: () => void;
};

const LoginModalContext = createContext<LoginModalContextValue | null>(null);

export function useLoginModal() {
  const ctx = useContext(LoginModalContext);
  if (!ctx) {
    throw new Error("useLoginModal must be used within LoginModalProvider");
  }
  return ctx;
}

export function LoginModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <LoginModalContext.Provider
      value={{
        openLogin: () => setOpen(true),
        closeLogin: () => setOpen(false),
      }}
    >
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 overflow-hidden border-border/60 p-0 sm:max-w-md">
          <div className="border-b bg-gradient-to-br from-inkai-red/8 via-background to-inkai-yellow/8 px-6 pb-5 pt-6">
            <DialogHeader className="items-center text-center">
              <div className="mb-3 rounded-full bg-background p-1 shadow-md ring-1 ring-border/60">
                <Image
                  src="/logo-inkai.png"
                  alt="Logo INKAI"
                  width={56}
                  height={56}
                  className="rounded-full"
                />
              </div>
              <DialogTitle className="text-lg font-bold">Masuk Anggota</DialogTitle>
              <DialogDescription>
                Login dengan email atau NIA yang terdaftar di database INKAI Surabaya.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 py-5">
            <LoginForm
              idPrefix="modal"
              onSuccess={() => setOpen(false)}
            />
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Belum punya akun?{" "}
              <Link
                href="/daftar"
                className="font-medium text-inkai-red hover:underline"
                onClick={() => setOpen(false)}
              >
                Daftar di sini
              </Link>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </LoginModalContext.Provider>
  );
}
