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
  /** No. MSH — opsional, khusus Hitam/DAN (admin tambah anggota). */
  mshNumber: string;
};

export type MemberFormSuggestion = {
  id: string;
  fullName: string;
  nia?: string | null;
  dojoName?: string;
  branchName?: string | null;
  currentRank?: string;
  status?: string;
  hasAccount?: boolean;
  isArchived?: boolean;
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
  /**
   * Daftar mandiri: identitas lengkap wajib (kecuali NIA).
   * Admin ranting/cabang: biarkan false (NIK dkk opsional).
   */
  requireCompleteIdentity?: boolean;
  /** Jika true, ada duplikat keras — UI merah + petunjuk blok. */
  duplicateBlocked?: boolean;
};

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground";
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
  opts?: {
    requireFullName?: boolean;
    /** Daftar mandiri: semua identitas wajib kecuali NIA. */
    requireCompleteIdentity?: boolean;
  },
): string | null {
  if (opts?.requireFullName !== false && !form.fullName.trim()) {
    return "Nama lengkap wajib diisi";
  }

  if (opts?.requireCompleteIdentity) {
    if (!form.gender || (form.gender !== "L" && form.gender !== "P")) {
      return "Jenis kelamin wajib dipilih";
    }
    if (!form.birthPlace.trim()) {
      return "Tempat lahir wajib diisi";
    }
    if (!form.birthDate.trim()) {
      return "Tanggal lahir wajib diisi";
    }
    if (!form.address.trim() || form.address.trim().length < 5) {
      return "Alamat wajib diisi";
    }
    if (!/^\d{16}$/.test(form.nik.trim())) {
      return "NIK wajib 16 digit";
    }
    if (!form.phoneNumber.trim() || form.phoneNumber.trim().length < 10) {
      return "Nomor telepon wajib diisi";
    }
    const nia = form.nia.trim();
    if (nia && (nia.length < 2 || nia.length > 32)) {
      return "NIA harus 2–32 karakter jika diisi";
    }
    return null;
  }

  if (form.nik && !/^\d{16}$/.test(form.nik.trim())) {
    return "NIK opsional — kosongkan atau isi tepat 16 digit";
  }
  const nia = form.nia.trim();
  if (nia && (nia.length < 2 || nia.length > 32)) {
    return "NIA harus 2–32 karakter jika diisi";
  }
  const msh = form.mshNumber.replace(/\s+/g, "").trim();
  if (msh && (msh.length < 2 || msh.length > 32)) {
    return "No. MSH harus 2–32 karakter jika diisi";
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
  requireCompleteIdentity = false,
  duplicateBlocked = false,
}: MemberFormSectionProps) {
  const hasHard = duplicateBlocked || suggestions.some((s) => s.severity === "hard");
  const hasArchivedIdOnly =
    !duplicateBlocked &&
    suggestions.some(
      (s) =>
        s.isArchived &&
        s.severity === "hard" &&
        (s.matchReasons?.includes("NIA") || s.matchReasons?.includes("NIK")) &&
        !s.matchReasons?.includes("NAME_BIRTHDATE"),
    );
  const boxClass = hasHard && !hasArchivedIdOnly
    ? "rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100"
    : "rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100";
  const req = requireCompleteIdentity;

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Identitas
      </h3>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>
          Nama Lengkap{fullNameRequired || req ? " *" : ""}
        </Label>
        <Input
          id={`${idPrefix}-name`}
          className={upperInputClassName}
          value={form.fullName}
          onChange={(e) => onChange("fullName", upperText(e.target.value))}
          placeholder="NAMA SESUAI IDENTITAS"
          autoCapitalize="characters"
          required={fullNameRequired || req}
        />
        {suggestions.length > 0 ? (
          <div className={boxClass}>
            <p className="mb-1 font-medium">
              {hasHard && !hasArchivedIdOnly
                ? "Duplikat terdeteksi — tidak dapat mendaftar ulang:"
                : hasArchivedIdOnly
                  ? "NIA/NIK masih di arsip — saat simpan nomor akan dilepas dari arsip:"
                  : "Kemungkinan sudah terdaftar — periksa sebelum simpan:"}
            </p>
            <ul className="space-y-0.5">
              {suggestions.slice(0, 5).map((s) => (
                <li key={s.id}>
                  {s.fullName}
                  {s.nia ? ` · ${s.nia}` : " · tanpa NIA"}
                  {s.dojoName ? ` · ${s.dojoName}` : ""}
                  {s.branchName ? ` · ${s.branchName}` : ""}
                  {s.isArchived ? " · ARSIP" : ""}
                  {s.status && !s.isArchived ? ` · ${s.status}` : ""}
                  {s.hasAccount === false ? " · belum punya akun" : ""}
                  {s.hasAccount === true ? " · sudah punya akun" : ""}
                  {reasonLabel(s.matchReasons)
                    ? ` · cocok ${reasonLabel(s.matchReasons)}`
                    : ""}
                </li>
              ))}
            </ul>
            {hasHard && !hasArchivedIdOnly ? (
              <p className="mt-1.5">
                Hubungi pengurus ranting/cabang jika perlu menghubungkan akun,
                jangan buat data baru.
              </p>
            ) : null}
            {hasArchivedIdOnly ? (
              <p className="mt-1.5">
                Data aktif tidak bentrok. Anda bisa menyimpan — NIA/NIK arsip
                akan dikosongkan agar bisa dipakai ulang.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-gender`}>
          Jenis Kelamin{req ? " *" : ""}
        </Label>
        <select
          id={`${idPrefix}-gender`}
          className={selectClassName}
          value={form.gender}
          onChange={(e) => onChange("gender", e.target.value)}
          required={req}
        >
          <option value="">Pilih</option>
          <option value="L">Laki-laki</option>
          <option value="P">Perempuan</option>
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-birth-place`}>
            Tempat Lahir{req ? " *" : ""}
          </Label>
          <Input
            id={`${idPrefix}-birth-place`}
            className={upperInputClassName}
            value={form.birthPlace}
            onChange={(e) => onChange("birthPlace", upperText(e.target.value))}
            placeholder="KOTA / KABUPATEN"
            autoCapitalize="characters"
            required={req}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-birth-date`}>
            Tanggal Lahir{req ? " *" : ""}
          </Label>
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
            required={req}
          />
          <p className="text-[11px] text-muted-foreground">
            Bisa paste, mis. 28 Februari 2011
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-address`}>
          Alamat{req ? " *" : ""}
        </Label>
        <Input
          id={`${idPrefix}-address`}
          className={upperInputClassName}
          value={form.address}
          onChange={(e) => onChange("address", upperText(e.target.value))}
          placeholder="ALAMAT LENGKAP"
          autoCapitalize="characters"
          required={req}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-nik`}>
          {req ? "NIK *" : "NIK (opsional)"}
        </Label>
        <Input
          id={`${idPrefix}-nik`}
          inputMode="numeric"
          maxLength={16}
          placeholder={req ? "16 digit wajib" : "16 digit — boleh dikosongkan"}
          value={form.nik}
          onChange={(e) =>
            onChange("nik", e.target.value.replace(/\D/g, "").slice(0, 16))
          }
          required={req}
        />
        <p className="text-xs text-muted-foreground">
          {req
            ? "Wajib diisi sesuai KTP/identitas."
            : "Ranting/cabang boleh menyimpan tanpa NIK; lengkapi nanti bila sudah ada."}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-nia`}>NIA (opsional)</Label>
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
        <Label htmlFor={`${idPrefix}-phone`}>
          Telepon{req ? " *" : ""}
        </Label>
        <Input
          id={`${idPrefix}-phone`}
          className={upperInputClassName}
          inputMode="tel"
          placeholder={req ? "WAJIB — NOMOR AKTIF" : "OPSIONAL"}
          value={form.phoneNumber}
          onChange={(e) => onChange("phoneNumber", upperText(e.target.value))}
          autoCapitalize="characters"
          required={req}
        />
      </div>
    </section>
  );
}

export function MemberBeltSection({
  idPrefix,
  form,
  onChange,
  showMsh = false,
}: Pick<MemberFormSectionProps, "idPrefix" | "form" | "onChange"> & {
  /** Tampilkan No. MSH (admin Tambah Anggota). */
  showMsh?: boolean;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Sabuk
      </h3>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-rank`}>Tingkatan Kyu / DAN</Label>
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
      {showMsh ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-msh`}>No. MSH (opsional)</Label>
          <Input
            id={`${idPrefix}-msh`}
            className={upperInputClassName}
            placeholder="KHUSUS SABUK HITAM / DAN"
            maxLength={32}
            value={form.mshNumber}
            onChange={(e) =>
              onChange(
                "mshNumber",
                e.target.value.replace(/\s+/g, "").toUpperCase(),
              )
            }
            autoCapitalize="characters"
          />
          <p className="text-xs text-muted-foreground">
            Boleh dikosongkan. No. MSH hanya untuk sabuk Hitam (DAN).
          </p>
        </div>
      ) : null}
    </section>
  );
}
