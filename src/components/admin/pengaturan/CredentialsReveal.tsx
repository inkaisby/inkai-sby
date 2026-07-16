"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, X } from "lucide-react";
import { showSuccess } from "@/lib/client-toast";

export type CredentialPayload = {
  title: string;
  loginEmail: string;
  loginPassword: string;
  hint?: string;
};

export function CredentialsReveal({
  credential,
  onDismiss,
}: {
  credential: CredentialPayload | null;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  if (!credential) return null;

  async function copyAll() {
    const text = `Username: ${credential!.loginEmail}\nPassword: ${credential!.loginPassword}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showSuccess("Kredensial disalin ke clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showSuccess("Salin manual dari kotak di bawah");
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-emerald-800 dark:text-emerald-300">
            {credential.title}
          </p>
          <p className="text-sm text-muted-foreground">
            {credential.hint ||
              "Salin sekarang — password tidak ditampilkan lagi setelah ditutup."}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border bg-background px-3 py-2">
          <p className="text-xs text-muted-foreground">Username</p>
          <p className="font-mono text-sm">{credential.loginEmail}</p>
        </div>
        <div className="rounded-lg border bg-background px-3 py-2">
          <p className="text-xs text-muted-foreground">Password</p>
          <p className="font-mono text-sm">{credential.loginPassword}</p>
        </div>
      </div>
      <div className="mt-3">
        <Button type="button" size="sm" variant="outline" onClick={copyAll} className="gap-1.5">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Tersalin" : "Salin Username + Password"}
        </Button>
      </div>
    </div>
  );
}
