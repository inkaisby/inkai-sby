import Image from "next/image";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { outer: 32, logo: 20, ring: "border" },
  md: { outer: 88, logo: 52, ring: "border-2" },
  lg: { outer: 120, logo: 72, ring: "border-2" },
} as const;

type InkaiLogoLoaderProps = {
  size?: keyof typeof SIZES;
  message?: string;
  showDots?: boolean;
  className?: string;
};

export function InkaiLogoLoader({
  size = "md",
  message,
  showDots = true,
  className,
}: InkaiLogoLoaderProps) {
  const s = SIZES[size];
  const showMessage = message && size !== "sm";

  return (
    <div
      className={cn("flex flex-col items-center", className)}
      role="status"
      aria-live="polite"
      aria-label={message || "Memuat"}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: s.outer, height: s.outer }}
      >
        <div
          className={cn(
            "inkai-loader-ring-outer absolute inset-0 rounded-full",
            s.ring,
            "border-transparent",
          )}
          aria-hidden
        />
        {size !== "sm" && (
          <div
            className={cn(
              "inkai-loader-ring-inner absolute rounded-full border border-transparent",
              size === "lg" ? "inset-2" : "inset-1.5",
            )}
            aria-hidden
          />
        )}
        {size !== "sm" && (
          <div
            className="absolute inset-3 rounded-full bg-inkai-red/[0.04] dark:bg-inkai-red/10"
            aria-hidden
          />
        )}
        <div
          className={cn(
            "relative z-10 overflow-hidden rounded-full bg-background shadow-sm ring-1 ring-inkai-red/20",
            size === "sm" ? "p-0.5" : size === "md" ? "p-1.5" : "p-2",
          )}
        >
          <Image
            src="/logo-inkai.png"
            alt=""
            width={s.logo}
            height={s.logo}
            className="inkai-loader-logo rounded-full"
            priority={size !== "sm"}
          />
        </div>
      </div>

      {showMessage && (
        <p className="mt-5 text-sm font-medium tracking-wide text-muted-foreground">
          {message}
        </p>
      )}

      {showDots && size !== "sm" && (
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="inkai-loader-dot size-1.5 rounded-full bg-inkai-red"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
