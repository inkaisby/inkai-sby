"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { PresenceHeartbeat } from "@/components/presence/PresenceHeartbeat";

export default function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  return (
    <SessionProvider
      session={session}
      refetchInterval={0}
      refetchOnWindowFocus={false}
    >
      <ThemeProvider>
        <PresenceHeartbeat />
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast: "font-sans",
            },
          }}
        />
      </ThemeProvider>
    </SessionProvider>
  );
}
