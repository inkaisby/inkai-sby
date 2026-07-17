"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BELT_RANK_OPTIONS } from "@/lib/belt";

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
};

const selectClassName = "h-9 w-full rounded-lg border px-2 text-sm";

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
}: MemberFormSectionProps) {
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
          value={form.fullName}
          onChange={(e) => onChange("fullName", e.target.value)}
          placeholder="Nama sesuai identitas"
          required={fullNameRequired}
        />
        {suggestions.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="mb-1 font-medium">
              Kemungkinan sudah terdaftar — periksa sebelum simpan:
            </p>
            <ul className="space-y-0.5">
              {suggestions.slice(0, 5).map((s) => (
                <li key={s.id}>
                  {s.fullName}
                  {s.nia ? ` · ${s.nia}` : " · tanpa NIA"}
                  {s.dojoName ? ` · ${s.dojoName}` : ""}
                </li>
              ))}
            </ul>
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
            value={form.birthPlace}
            onChange={(e) => onChange("birthPlace", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-birth-date`}>Tanggal Lahir</Label>
          <Input
            id={`${idPrefix}-birth-date`}
            type="date"
            value={form.birthDate}
            onChange={(e) => onChange("birthDate", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-address`}>Alamat</Label>
        <Input
          id={`${idPrefix}-address`}
          value={form.address}
          onChange={(e) => onChange("address", e.target.value)}
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
          placeholder="Opsional — isi jika sudah punya NIA"
          maxLength={32}
          value={form.nia}
          onChange={(e) => onChange("nia", e.target.value.toUpperCase())}
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
          inputMode="tel"
          placeholder="Opsional"
          value={form.phoneNumber}
          onChange={(e) => onChange("phoneNumber", e.target.value)}
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
