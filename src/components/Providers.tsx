"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { useTheme } from "next-themes";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { PresenceHeartbeat } from "@/components/presence/PresenceHeartbeat";
import { InkaiLogoLoader } from "@/components/ui/InkaiLogoLoader";

function AppToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="top-center"
      richColors
      closeButton
      icons={{
        loading: (
          <InkaiLogoLoader size="sm" showDots={false} className="shrink-0" />
        ),
      }}
      toastOptions={{
        classNames: {
          toast:
            "font-sans !rounded-xl !border-border/60 !shadow-lg !shadow-black/5",
          loading:
            "inkai-toast-loading !bg-background !text-foreground !border-inkai-red/15",
          title: "!text-sm !font-medium !tracking-wide",
        },
      }}
    />
  );
}

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
        <AppToaster />
      </ThemeProvider>
    </SessionProvider>
  );
}
