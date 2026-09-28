export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://inkai-sby.vercel.app";

export const SITE_BRANCH_NAME = "SURABAYA";
export const SITE_PROVINCE_NAME = "JAWA TIMUR";

export const SITE_CONTACT = {
  address: "Jl. Raya Darmo Permai III No. 12, Surabaya, Jawa Timur 60226",
  phone: "085731241840",
  whatsapp: "6285731241840",
  email: "inkai.sby@gmail.com",
  instagram: "https://instagram.com/inkaisurabaya",
  mapsUrl: "https://maps.google.com/?q=INKAI+Surabaya",
  hours: "Senin–Sabtu, 08.00–17.00 WIB",
};

export const DEFAULT_ADMIN_WA = {
  phone: "085731241840",
  waNumber: "6285731241840",
};

export function getAdminWaPhone(): { phone: string; waNumber: string } {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("inkai_admin_wa_phone");
    if (saved && saved.trim().length >= 8) {
      const clean = saved.trim().replace(/[^0-9]/g, "");
      const waNumber = clean.startsWith("0") ? "62" + clean.slice(1) : clean.startsWith("62") ? clean : "62" + clean;
      const formattedPhone = clean.startsWith("62") ? "0" + clean.slice(2) : clean;
      return { phone: formattedPhone, waNumber };
    }
  }
  return DEFAULT_ADMIN_WA;
}

export function setAdminWaPhone(newPhone: string): { phone: string; waNumber: string } {
  const clean = newPhone.trim().replace(/[^0-9]/g, "");
  if (typeof window !== "undefined") {
    localStorage.setItem("inkai_admin_wa_phone", clean);
  }
  const waNumber = clean.startsWith("0") ? "62" + clean.slice(1) : clean.startsWith("62") ? clean : "62" + clean;
  const formattedPhone = clean.startsWith("62") ? "0" + clean.slice(2) : clean;
  return { phone: formattedPhone, waNumber };
}


