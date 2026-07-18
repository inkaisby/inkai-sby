/** Label status operasional (hindari enum Inggris di UI pengurus). */

export function billingStatusLabel(status: string): string {
  switch (status) {
    case "PAID":
      return "Lunas";
    case "WAITING_VERIFICATION":
      return "Menunggu verifikasi";
    case "PENDING":
      return "Belum bayar";
    case "REJECTED":
      return "Ditolak";
    case "CANCELLED":
      return "Dibatalkan";
    default:
      return status || "—";
  }
}

export function storeOrderStatusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return "Menunggu";
    case "CONFIRMED":
      return "Dikonfirmasi";
    case "DONE":
      return "Selesai";
    case "CANCELLED":
      return "Dibatalkan";
    default:
      return status || "—";
  }
}

export const STORE_ORDER_STATUS_ACTIONS = [
  { value: "CONFIRMED", label: "Konfirmasi" },
  { value: "DONE", label: "Selesai" },
  { value: "CANCELLED", label: "Batalkan" },
] as const;
