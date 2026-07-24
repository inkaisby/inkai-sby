import { toast } from "sonner";

export function showLoading(message: string) {
  return toast.loading(message);
}

export function showSuccess(
  message: string,
  opts?: { id?: string | number },
) {
  toast.success(message, { duration: 4000, id: opts?.id });
}

export function showError(
  message: string,
  opts?: { id?: string | number },
) {
  toast.error(message, { duration: 5000, id: opts?.id });
}
