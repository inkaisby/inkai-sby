"use client";

import { beltRingVisual } from "@/lib/belt";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function MemberAvatarRing({
  fullName,
  currentRank,
  photoUrl,
  size = "default",
}: {
  fullName?: string;
  currentRank?: string | null;
  photoUrl?: string | null;
  size?: "default" | "sm" | "lg";
}) {
  const ring = beltRingVisual(currentRank);
  const initial = fullName?.charAt(0)?.toUpperCase() || "?";
  const sizeClass = size === "lg" ? "size-12" : size === "sm" ? "size-8" : "size-10";

  return (
    <div
      className={`relative ${sizeClass} shrink-0 rounded-full`}
      style={{
        boxShadow: ring.shadow || `0 0 0 3px ${ring.bg}`,
      }}
    >
      <Avatar size={size} className="size-full">
        {photoUrl ? (
          <AvatarImage src={photoUrl} alt={fullName || "Foto"} />
        ) : null}
        <AvatarFallback
          className="font-bold"
          style={{ backgroundColor: ring.bg, color: ring.bg === "#e2e8f0" ? "#334155" : "#fff" }}
        >
          {initial}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
