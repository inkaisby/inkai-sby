import { formatGenderLabel } from "@/lib/belt";

export type RegisterVerificationWaFields = {
  fullName: string;
  gender?: string;
  birthPlace?: string;
  birthDate?: string;
  address?: string;
  nia?: string;
  mshNumber?: string;
  phoneNumber?: string;
  email: string;
};

function formatGenderForWa(gender: string | undefined): string {
  const label = formatGenderLabel(gender);
  if (label === "L") return "Laki-laki";
  if (label === "P") return "Perempuan";
  return label || "—";
}

export function formatRegisterBirthDate(iso: string | undefined): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.trim();
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function buildRegisterVerificationWaMessage(
  fields: RegisterVerificationWaFields,
): string {
  const lines = [
    "Mohon di verifikasi",
    `Nama Lengkap: ${fields.fullName.trim()}`,
    `Jenis Kelamin: ${formatGenderForWa(fields.gender)}`,
    `Tempat Lahir: ${fields.birthPlace?.trim() || "—"}`,
    `Tanggal Lahir: ${formatRegisterBirthDate(fields.birthDate)}`,
    `Alamat: ${fields.address?.trim() || "—"}`,
  ];
  if (fields.nia?.trim()) lines.push(`NIA: ${fields.nia.trim()}`);
  if (fields.mshNumber?.trim()) lines.push(`No. MSH: ${fields.mshNumber.trim()}`);
  lines.push(`Telepon: ${fields.phoneNumber?.trim() || "—"}`);
  lines.push(`Email: ${fields.email.trim()}`);
  lines.push("", "Terima Kasih");
  return lines.join("\n");
}

export function buildRegisterVerificationWaUrl(
  phoneDigits: string,
  message: string,
): string {
  const clean = phoneDigits.replace(/\D/g, "");
  return `https://api.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(message)}`;
}
