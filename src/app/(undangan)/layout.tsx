import type { ReactNode } from "react";
import { Cormorant_Garamond, Source_Sans_3 } from "next/font/google";

const inviteDisplay = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-invite-display",
  display: "swap",
});

const inviteBody = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-invite-body",
  display: "swap",
});

export default function UndanganLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${inviteDisplay.variable} ${inviteBody.variable}`}>
      {children}
    </div>
  );
}
