"use client";

import { BottomNav } from "@/components/member/BottomNav";
import { MemberWelcomeGuide } from "@/components/member/MemberWelcomeGuide";
import { MemberAdminPortalLink } from "@/components/member/MemberAdminPortalLink";

export function MemberMobileShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#dfe6ef] dark:bg-[#0b0c10]">
      <div
        className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-background shadow-[0_0_40px_rgba(0,0,0,0.12)] dark:shadow-[0_0_40px_rgba(0,0,0,0.45)]"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingLeft: "max(16px, env(safe-area-inset-left))",
          paddingRight: "max(16px, env(safe-area-inset-right))",
        }}
      >
        <MemberAdminPortalLink compact withBar />
        <div className="member-fade-in flex-1 pb-[100px]">{children}</div>
        <BottomNav />
        <MemberWelcomeGuide />
      </div>
    </div>
  );
}
