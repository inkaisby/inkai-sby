import { redirect } from "next/navigation";

/** Digabung ke Pengaturan Ranting & User — kelola akun ranting di sana. */
export default function PengaturanUserRedirectPage() {
  redirect("/admin/pengaturan/ranting");
}
