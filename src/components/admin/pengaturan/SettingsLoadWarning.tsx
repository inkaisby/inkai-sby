import { AlertTriangle } from "lucide-react";

export function SettingsLoadWarning({
  message = "Sebagian data gagal dimuat karena server sibuk. Refresh halaman atau coba lagi sebentar.",
}: {
  message?: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-950 dark:text-amber-100">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p>{message}</p>
    </div>
  );
}
