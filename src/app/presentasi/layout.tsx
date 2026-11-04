import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Video Motion Presentasi — INKAI Cabang Surabaya",
  description: "Presentasi Motion & Storyboard Interaktif Ekosistem Digital Institut Karate-Do Indonesia (INKAI) Cabang Surabaya.",
  robots: {
    index: false,
    follow: false
  }
};

export default function PresentasiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen antialiased overflow-hidden">
      {children}
    </div>
  );
}
