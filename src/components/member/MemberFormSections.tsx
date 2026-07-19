"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BELT_RANK_OPTIONS } from "@/lib/belt";
import { parseFlexibleBirthDate } from "@/lib/parse-birth-date";

export type MemberFormFields = {
  fullName: string;
  gender: string;
  birthPlace: string;
  birthDate: string;
  address: string;
  nik: string;
  nia: string;
  phoneNumber: string;
  currentRank: string;
};

export type MemberFormSuggestion = {
  id: string;
  fullName: string;
  nia?: string | null;
  dojoName?: string;
  currentRank?: string;
  status?: string;
  hasAccount?: boolean;
  matchReasons?: string[];
  severity?: "hard" | "soft";
};

type MemberFormSectionProps = {
  idPrefix: string;
  form: MemberFormFields;
  onChange: <K extends keyof MemberFormFields>(
    key: K,
    value: MemberFormFields[K],
  ) => void;
  suggestions?: MemberFormSuggestion[];
  fullNameRequired?: boolean;
  /** Jika true, ada duplikat keras — UI merah + petunjuk blok. */
  duplicateBlocked?: boolean;
};

const selectClassName = "h-9 w-full rounded-lg border px-2 text-sm";
const upperInputClassName = "uppercase";

/** Field teks identitas disimpan huruf besar. */
function upperText(value: string) {
  return value.toUpperCase();
}

function reasonLabel(reasons?: string[]) {
  if (!reasons?.length) return null;
  const map: Record<string, string> = {
    NIK: "NIK",
    NIA: "NIA",
    NAME_BIRTHDATE: "nama + tgl lahir",
    NAME: "nama",
  };
  return reasons.map((r) => map[r] ?? r).join(", ");
}

export function validateMemberFormFields(
  form: MemberFormFields,
  opts?: { requireFullName?: boolean },
): string | null {
  if (opts?.requireFullName !== false && !form.fullName.trim()) {
    return "Nama lengkap wajib diisi";
  }
  if (form.nik && !/^\d{16}$/.test(form.nik.trim())) {
    return "NIK harus 16 digit";
  }
  const nia = form.nia.trim();
  if (nia && (nia.length < 2 || nia.length > 32)) {
    return "NIA harus 2–32 karakter jika diisi";
  }
  if (form.phoneNumber && form.phoneNumber.trim().length < 10) {
    return "Nomor telepon tidak valid";
  }
  return null;
}

export function MemberIdentitySection({
  idPrefix,
  form,
  onChange,
  suggestions = [],
  fullNameRequired = true,
  duplicateBlocked = false,
}: MemberFormSectionProps) {
  const hasHard = duplicateBlocked || suggestions.some((s) => s.severity === "hard");
  const boxClass = hasHard
    ? "rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100"
    : "rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100";

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Identitas
      </h3>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>
          Nama Lengkap{fullNameRequired ? " *" : ""}
        </Label>
        <Input
          id={`${idPrefix}-name`}
          className={upperInputClassName}
          value={form.fullName}
          onChange={(e) => onChange("fullName", upperText(e.target.value))}
          placeholder="NAMA SESUAI IDENTITAS"
          autoCapitalize="characters"
          required={fullNameRequired}
        />
        {suggestions.length > 0 ? (
          <div className={boxClass}>
            <p className="mb-1 font-medium">
              {hasHard
                ? "Duplikat terdeteksi — tidak dapat mendaftar ulang:"
                : "Kemungkinan sudah terdaftar — periksa sebelum simpan:"}
            </p>
            <ul className="space-y-0.5">
              {suggestions.slice(0, 5).map((s) => (
                <li key={s.id}>
                  {s.fullName}
                  {s.nia ? ` · ${s.nia}` : " · tanpa NIA"}
                  {s.dojoName ? ` · ${s.dojoName}` : ""}
                  {s.status ? ` · ${s.status}` : ""}
                  {s.hasAccount === false ? " · belum punya akun" : ""}
                  {s.hasAccount === true ? " · sudah punya akun" : ""}
                  {reasonLabel(s.matchReasons)
                    ? ` · cocok ${reasonLabel(s.matchReasons)}`
                    : ""}
                </li>
              ))}
            </ul>
            {hasHard ? (
              <p className="mt-1.5">
                Hubungi pengurus ranting/cabang jika perlu menghubungkan akun,
                jangan buat data baru.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-gender`}>Jenis Kelamin</Label>
        <select
          id={`${idPrefix}-gender`}
          className={selectClassName}
          value={form.gender}
          onChange={(e) => onChange("gender", e.target.value)}
        >
          <option value="">Pilih</option>
          <option value="L">Laki-laki</option>
          <option value="P">Perempuan</option>
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-birth-place`}>Tempat Lahir</Label>
          <Input
            id={`${idPrefix}-birth-place`}
            className={upperInputClassName}
            value={form.birthPlace}
            onChange={(e) => onChange("birthPlace", upperText(e.target.value))}
            placeholder="KOTA / KABUPATEN"
            autoCapitalize="characters"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-birth-date`}>Tanggal Lahir</Label>
          <Input
            id={`${idPrefix}-birth-date`}
            type="date"
            value={form.birthDate}
            onChange={(e) => onChange("birthDate", e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              const parsed = parseFlexibleBirthDate(text);
              if (parsed) {
                e.preventDefault();
                onChange("birthDate", parsed);
              }
            }}
          />
          <p className="text-[11px] text-muted-foreground">
            Bisa paste, mis. 28 Februari 2011
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-address`}>Alamat</Label>
        <Input
          id={`${idPrefix}-address`}
          className={upperInputClassName}
          value={form.address}
          onChange={(e) => onChange("address", upperText(e.target.value))}
          placeholder="ALAMAT LENGKAP"
          autoCapitalize="characters"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-nik`}>NIK</Label>
        <Input
          id={`${idPrefix}-nik`}
          inputMode="numeric"
          maxLength={16}
          placeholder="16 digit (opsional)"
          value={form.nik}
          onChange={(e) =>
            onChange("nik", e.target.value.replace(/\D/g, "").slice(0, 16))
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-nia`}>NIA (Nomor Induk Anggota)</Label>
        <Input
          id={`${idPrefix}-nia`}
          className={upperInputClassName}
          placeholder="OPSIONAL — ISI JIKA SUDAH PUNYA NIA"
          maxLength={32}
          value={form.nia}
          onChange={(e) => onChange("nia", upperText(e.target.value))}
          autoCapitalize="characters"
        />
        <p className="text-xs text-muted-foreground">
          Kosongkan bila belum memiliki NIA; pengurus cabang dapat mengisinya
          nanti.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-phone`}>Telepon</Label>
        <Input
          id={`${idPrefix}-phone`}
          className={upperInputClassName}
          inputMode="tel"
          placeholder="OPSIONAL"
          value={form.phoneNumber}
          onChange={(e) => onChange("phoneNumber", upperText(e.target.value))}
          autoCapitalize="characters"
        />
      </div>
    </section>
  );
}

export function MemberBeltSection({
  idPrefix,
  form,
  onChange,
}: Pick<MemberFormSectionProps, "idPrefix" | "form" | "onChange">) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Sabuk
      </h3>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-rank`}>Kyu saat ini (Kyu Lama)</Label>
        <select
          id={`${idPrefix}-rank`}
          className={selectClassName}
          value={form.currentRank}
          onChange={(e) => onChange("currentRank", e.target.value)}
        >
          {BELT_RANK_OPTIONS.map((rank) => (
            <option key={rank} value={rank}>
              {rank}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
