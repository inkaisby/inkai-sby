import { toast } from "sonner";

export function showSuccess(message: string) {
  toast.success(message, { duration: 4000 });
}

export function showError(message: string) {
  toast.error(message, { duration: 5000 });
}
