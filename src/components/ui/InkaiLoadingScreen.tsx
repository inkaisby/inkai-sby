import Image from "next/image";

export function InkaiLoadingScreen({
  message = "Memuat...",
  fullscreen = true,
}: {
  message?: string;
  fullscreen?: boolean;
}) {
  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm"
          : "flex min-h-[40vh] flex-col items-center justify-center py-16"
      }
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      <div className="relative mb-6">
        <div className="absolute inset-0 animate-ping rounded-full bg-inkai-red/20" />
        <div className="relative rounded-full bg-background p-2 shadow-lg ring-2 ring-inkai-red/30">
          <Image
            src="/logo-inkai.png"
            alt="INKAI"
            width={72}
            height={72}
            className="animate-[inkai-pulse_1.2s_ease-in-out_infinite] rounded-full"
            priority
          />
        </div>
      </div>
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      <div className="mt-4 flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-2 animate-bounce rounded-full bg-inkai-red"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
