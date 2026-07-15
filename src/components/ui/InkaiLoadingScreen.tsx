import { InkaiLogoLoader } from "@/components/ui/InkaiLogoLoader";
import { cn } from "@/lib/utils";

export function InkaiLoadingScreen({
  message = "Memuat...",
  fullscreen = true,
}: {
  message?: string;
  fullscreen?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        fullscreen
          ? "fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm"
          : "min-h-[40vh] py-16",
      )}
    >
      <InkaiLogoLoader size="lg" message={message} />
    </div>
  );
}
