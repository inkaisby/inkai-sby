/** Angka → terbilang Indonesia (Rupiah), tanpa "rupiah" di akhir kecuali diminta. */

const SATUAN = [
  "",
  "satu",
  "dua",
  "tiga",
  "empat",
  "lima",
  "enam",
  "tujuh",
  "delapan",
  "sembilan",
  "sepuluh",
  "sebelas",
];

function terbilangBelowThousand(n: number): string {
  if (n < 12) return SATUAN[n] ?? "";
  if (n < 20) return `${SATUAN[n - 10]} belas`;
  if (n < 100) {
    const puluh = Math.floor(n / 10);
    const sisa = n % 10;
    return `${SATUAN[puluh]} puluh${sisa ? ` ${SATUAN[sisa]}` : ""}`.trim();
  }
  const ratus = Math.floor(n / 100);
  const sisa = n % 100;
  const head = ratus === 1 ? "seratus" : `${SATUAN[ratus]} ratus`;
  return sisa ? `${head} ${terbilangBelowThousand(sisa)}` : head;
}

function terbilangPositive(n: number): string {
  if (n === 0) return "nol";
  if (n < 1000) return terbilangBelowThousand(n);

  const scales: Array<{ v: number; label: string; satu?: string }> = [
    { v: 1_000_000_000_000, label: "triliun" },
    { v: 1_000_000_000, label: "miliar" },
    { v: 1_000_000, label: "juta" },
    { v: 1_000, label: "ribu", satu: "seribu" },
  ];

  for (const s of scales) {
    if (n >= s.v) {
      const qty = Math.floor(n / s.v);
      const rest = n % s.v;
      const head =
        qty === 1 && s.satu
          ? s.satu
          : `${terbilangPositive(qty)} ${s.label}`;
      return rest ? `${head} ${terbilangPositive(rest)}` : head;
    }
  }
  return terbilangBelowThousand(n);
}

/** Contoh: 1500000 → "satu juta lima ratus ribu rupiah" */
export function terbilangId(amount: number, withRupiah = true): string {
  const n = Math.floor(Math.abs(Number(amount) || 0));
  const words = terbilangPositive(n);
  const body = words.trim();
  if (!withRupiah) return body;
  return `${body} rupiah`;
}

export function formatRp(amount: number): string {
  const n = Math.floor(Number(amount) || 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}
