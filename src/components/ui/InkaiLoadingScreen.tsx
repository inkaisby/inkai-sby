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
          ? "inkai-transition-screen fixed inset-0 z-[200] bg-background/92"
          : "min-h-[40vh] py-16",
      )}
      /* Tanpa backdrop-blur: lebih ringan di GPU, tetap elegan */
    >
      <InkaiLogoLoader size="lg" message={message} />
    </div>
  );
}
