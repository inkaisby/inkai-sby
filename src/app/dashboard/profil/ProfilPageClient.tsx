"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FileUploadField } from "@/components/admin/FileUploadField";
import { DocumentPreviewDialog } from "@/components/admin/DocumentPreviewDialog";
import { showError, showSuccess } from "@/lib/client-toast";
import { MemberPageHeader } from "@/components/member/MemberPageHeader";
import { isBlackBeltRank } from "@/lib/belt";

type MemberProfile = {
  id: string;
  fullName: string;
  email: string;
  nik: string | null;
  nia: string | null;
  mshNumber: string | null;
  gender: string | null;
  birthPlace: string | null;
  birthDate: string;
  address: string | null;
  phoneNumber: string | null;
  photoUrl: string | null;
  birthCertificateUrl: string | null;
  bpjsCardUrl: string | null;
  bpjsCardNumber: string | null;
  currentRank: string;
  dojoLabel: string;
  status: string;
  isBlackBelt: boolean;
  locks: {
    email: boolean;
    nia: boolean;
    currentRank: boolean;
    mshNumber: boolean;
    emailSelfEditedAt: string | null;
    niaSelfEditedAt: string | null;
    rankSelfEditedAt: string | null;
    mshSelfEditedAt: string | null;
  };
};

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground";

function upper(value: string) {
  return value.toUpperCase();
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
      <h2 className="text-sm font-semibold tracking-wide text-foreground">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function LockHint({ locked }: { locked: boolean }) {
  if (!locked) {
    return (
      <p className="text-[11px] text-amber-700 dark:text-amber-300">
        Boleh diubah mandiri 1×. Setelah tersimpan, perubahan berikutnya lewat
        pengajuan.
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
      <Lock className="h-3 w-3" />
      Terkunci — ajukan perubahan di bawah
    </p>
  );
}

export default function ProfilPageClient({
  member,
  beltOptions,
}: {
  member: MemberProfile;
  beltOptions: string[];
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(member.fullName);
  const [gender, setGender] = useState(member.gender || "");
  const [birthPlace, setBirthPlace] = useState(member.birthPlace || "");
  const [birthDate, setBirthDate] = useState(member.birthDate || "");
  const [nik, setNik] = useState(member.nik || "");
  const [address, setAddress] = useState(member.address || "");
  const [phoneNumber, setPhoneNumber] = useState(member.phoneNumber || "");
  const [photoUrl, setPhotoUrl] = useState(member.photoUrl || "");
  const [akte, setAkte] = useState(member.birthCertificateUrl || "");
  const [bpjs, setBpjs] = useState(member.bpjsCardUrl || "");
  const [bpjsNo, setBpjsNo] = useState(member.bpjsCardNumber || "");
  const [email, setEmail] = useState(member.email || "");
  const [nia, setNia] = useState(member.nia || "");
  const [currentRank, setCurrentRank] = useState(member.currentRank || "");
  const [mshNumber, setMshNumber] = useState(member.mshNumber || "");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ title: string; url: string } | null>(
    null,
  );

  const [changeEmail, setChangeEmail] = useState("");
  const [changeNia, setChangeNia] = useState("");
  const [changeRank, setChangeRank] = useState("");
  const [changeMsh, setChangeMsh] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [submittingChange, setSubmittingChange] = useState(false);

  const showMsh = useMemo(
    () => isBlackBeltRank(currentRank) || member.isBlackBelt,
    [currentRank, member.isBlackBelt],
  );

  const anyLocked =
    member.locks.email ||
    member.locks.nia ||
    member.locks.currentRank ||
    member.locks.mshNumber;

  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  async function saveProfile(payload: Record<string, unknown>, okMsg?: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/member/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(
          (typeof data.error === "string" && data.error) ||
            "Gagal memperbarui profil",
        );
        return false;
      }
      showSuccess(
        (typeof data.message === "string" && data.message) ||
          okMsg ||
          "Profil berhasil diperbarui",
      );
      router.refresh();
      return true;
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (nik.trim() && !/^\d{16}$/.test(nik.trim())) {
      showError("NIK harus 16 digit atau dikosongkan");
      return;
    }

    const payload: Record<string, unknown> = {
      fullName,
      gender: gender || undefined,
      birthPlace,
      birthDate,
      address,
      phoneNumber,
      nik: nik.trim() || null,
      photoUrl: photoUrl.trim() || null,
      birthCertificateUrl: akte.trim() || null,
      bpjsCardUrl: bpjs.trim() || null,
      bpjsCardNumber: bpjsNo.replace(/\s+/g, "").trim() || null,
    };

    if (!member.locks.email && email.trim() && email.trim() !== member.email) {
      payload.email = email.trim().toLowerCase();
    }
    if (!member.locks.nia && nia.trim() && nia.trim() !== (member.nia || "")) {
      payload.nia = nia.trim();
    }
    if (
      !member.locks.currentRank &&
      currentRank.trim() &&
      currentRank.trim() !== member.currentRank
    ) {
      payload.currentRank = currentRank.trim();
    }
    if (
      showMsh &&
      !member.locks.mshNumber &&
      mshNumber.trim() &&
      mshNumber.trim() !== (member.mshNumber || "")
    ) {
      payload.mshNumber = mshNumber.trim();
    }

    await saveProfile(payload);
  }

  async function onPhotoUploaded(url: string) {
    setPhotoUrl(url);
    await saveProfile({ photoUrl: url }, "Foto profil disimpan");
  }

  async function onDocUploaded(
    field: "birthCertificateUrl" | "bpjsCardUrl",
    url: string,
  ) {
    if (field === "birthCertificateUrl") setAkte(url);
    else setBpjs(url);
    await saveProfile(
      {
        [field]: url,
        ...(field === "bpjsCardUrl" && bpjsNo.trim()
          ? { bpjsCardNumber: bpjsNo.replace(/\s+/g, "").trim() }
          : {}),
      },
      "Dokumen disimpan",
    );
  }

  async function submitProfileChange(e: React.FormEvent) {
    e.preventDefault();
    if (!changeReason.trim() || changeReason.trim().length < 5) {
      showError("Alasan pengajuan minimal 5 karakter");
      return;
    }
    const body: Record<string, string> = { reason: changeReason.trim() };
    if (member.locks.email && changeEmail.trim()) {
      body.email = changeEmail.trim().toLowerCase();
    }
    if (member.locks.nia && changeNia.trim()) body.nia = changeNia.trim();
    if (member.locks.currentRank && changeRank.trim()) {
      body.currentRank = changeRank.trim();
    }
    if (member.locks.mshNumber && changeMsh.trim()) {
      body.mshNumber = changeMsh.trim();
    }
    if (!body.email && !body.nia && !body.currentRank && !body.mshNumber) {
      showError("Isi minimal satu field terkunci yang ingin diubah");
      return;
    }

    setSubmittingChange(true);
    try {
      const res = await fetch("/api/member/profile-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(
          (typeof data.error === "string" && data.error) ||
            "Gagal mengirim pengajuan",
        );
        return;
      }
      showSuccess(
        (typeof data.message === "string" && data.message) ||
          "Pengajuan terkirim",
      );
      setChangeEmail("");
      setChangeNia("");
      setChangeRank("");
      setChangeMsh("");
      setChangeReason("");
      router.refresh();
    } finally {
      setSubmittingChange(false);
    }
  }

  return (
    <>
      <MemberPageHeader title="Profil Saya" />

      <div className="mb-4 rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Email akun, NIA, dan sabuk hanya boleh diubah mandiri{" "}
        <strong className="text-foreground">1×</strong>. Setelah itu, perubahan
        lewat pengajuan ke pengurus. No. MSH khusus sabuk Hitam (DAN) dan ikut
        tampil di Kartu Anggota.
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Section title="Ringkasan keanggotaan">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar className="h-20 w-20 ring-2 ring-inkai-red/20">
              {photoUrl ? <AvatarImage src={photoUrl} alt={fullName} /> : null}
              <AvatarFallback className="bg-inkai-red/10 text-lg font-semibold text-inkai-red">
                {initials || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1 text-sm">
              <p className="truncate text-base font-semibold">{fullName}</p>
              <p className="text-muted-foreground">
                NIA:{" "}
                <span className="font-mono text-foreground">
                  {member.nia || "Belum ada"}
                </span>
              </p>
              {member.isBlackBelt ? (
                <p className="text-muted-foreground">
                  No. MSH:{" "}
                  <span className="font-mono text-foreground">
                    {member.mshNumber || "Belum diisi"}
                  </span>
                </p>
              ) : null}
              <p className="text-muted-foreground">
                Sabuk:{" "}
                <span className="text-foreground">{member.currentRank}</span>
              </p>
              <p className="text-muted-foreground">
                Ranting:{" "}
                <span className="text-foreground">{member.dojoLabel}</span>
              </p>
            </div>
          </div>
        </Section>

        <Section
          title="Foto profil"
          description="Foto dipakai di kartu anggota dan kelengkapan profil."
        >
          <FileUploadField
            label="Unggah foto"
            value={photoUrl}
            folder="photo"
            uploadEndpoint="/api/member/upload"
            hideUrl
            compressToMaxBytes={150 * 1024}
            accept="image/jpeg,image/png,image/webp"
            hint="JPG/PNG/WebP, dikompres otomatis maks. ~150 KB"
            onChange={setPhotoUrl}
            onUploaded={(url) => void onPhotoUploaded(url)}
          />
        </Section>

        <Section
          title="Email, NIA & sabuk"
          description="Edit mandiri maksimal 1× per field."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email akun</Label>
              <Input
                id="email"
                type="email"
                value={email}
                disabled={member.locks.email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <LockHint locked={member.locks.email} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nia">NIA</Label>
              <Input
                id="nia"
                value={nia}
                disabled={member.locks.nia}
                onChange={(e) => setNia(upper(e.target.value))}
                className="font-mono uppercase"
              />
              <LockHint locked={member.locks.nia} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rank">Sabuk</Label>
              <select
                id="rank"
                className={selectClassName}
                value={currentRank}
                disabled={member.locks.currentRank}
                onChange={(e) => setCurrentRank(e.target.value)}
              >
                {!beltOptions.includes(currentRank) && currentRank ? (
                  <option value={currentRank}>{currentRank}</option>
                ) : null}
                {beltOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <LockHint locked={member.locks.currentRank} />
            </div>
            {showMsh ? (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="msh">No. MSH (sabuk Hitam / DAN)</Label>
                <Input
                  id="msh"
                  value={mshNumber}
                  disabled={member.locks.mshNumber}
                  onChange={(e) => setMshNumber(upper(e.target.value))}
                  className="font-mono uppercase"
                  placeholder="Nomor MSH"
                />
                <LockHint locked={member.locks.mshNumber} />
              </div>
            ) : null}
          </div>
        </Section>

        <Section title="Identitas">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="fullName">Nama lengkap</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(upper(e.target.value))}
                className="uppercase"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nik">NIK</Label>
              <Input
                id="nik"
                value={nik}
                onChange={(e) =>
                  setNik(e.target.value.replace(/\D/g, "").slice(0, 16))
                }
                inputMode="numeric"
                placeholder="16 digit"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Jenis kelamin</Label>
              <select
                id="gender"
                className={selectClassName}
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="">Pilih</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthPlace">Tempat lahir</Label>
              <Input
                id="birthPlace"
                value={birthPlace}
                onChange={(e) => setBirthPlace(upper(e.target.value))}
                className="uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthDate">Tanggal lahir</Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Alamat</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(upper(e.target.value))}
                className="uppercase"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="phone">Telepon / WA</Label>
              <Input
                id="phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="08…"
              />
            </div>
          </div>
        </Section>

        <Section
          title="Dokumen"
          description="Akte kelahiran dan kartu BPJS wajib untuk kegiatan & UKT."
        >
          <div className="space-y-2">
            <FileUploadField
              label="Akte kelahiran"
              value={akte}
              folder="akte"
              uploadEndpoint="/api/member/upload"
              hideUrl
              compressToMaxBytes={150 * 1024}
              accept="image/jpeg,image/png,image/webp,application/pdf"
              hint="Foto/scan dikompres maks. ~150 KB"
              onChange={setAkte}
              onUploaded={(url) =>
                void onDocUploaded("birthCertificateUrl", url)
              }
            />
            {akte ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2 text-inkai-red"
                onClick={() =>
                  setPreview({ title: "Akte kelahiran", url: akte })
                }
              >
                <Eye className="h-3.5 w-3.5" />
                Lihat akte
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            <FileUploadField
              label="Kartu BPJS"
              value={bpjs}
              folder="bpjs"
              uploadEndpoint="/api/member/upload"
              hideUrl
              compressToMaxBytes={150 * 1024}
              accept="image/jpeg,image/png,image/webp,application/pdf"
              hint="Foto/scan dikompres maks. ~150 KB"
              onChange={setBpjs}
              onUploaded={(url) => void onDocUploaded("bpjsCardUrl", url)}
            />
            {bpjs ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2 text-inkai-red"
                onClick={() => setPreview({ title: "Kartu BPJS", url: bpjs })}
              >
                <Eye className="h-3.5 w-3.5" />
                Lihat BPJS
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bpjsNo">Nomor BPJS (opsional)</Label>
            <Input
              id="bpjsNo"
              value={bpjsNo}
              onChange={(e) => setBpjsNo(e.target.value)}
              placeholder="0001234567890"
              className="font-mono text-sm"
            />
          </div>
        </Section>

        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <Button
            type="submit"
            disabled={loading}
            className="w-full gap-2 bg-inkai-red hover:bg-inkai-red/90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Simpan perubahan
          </Button>
          <p className="mt-3 text-sm text-muted-foreground">
            <Link
              href="/lupa-password"
              className="text-inkai-red hover:underline"
            >
              Lupa / reset password
            </Link>
            {" · "}
            <Link href="/dashboard/dokumen" className="hover:underline">
              Lihat ringkasan dokumen
            </Link>
          </p>
        </div>
      </form>

      {anyLocked ? (
        <form
          onSubmit={submitProfileChange}
          className="mt-4 space-y-4 rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-4 sm:p-5"
        >
          <div>
            <h2 className="text-sm font-semibold tracking-wide">
              Pengajuan ubah email / NIA / sabuk / MSH
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Field yang sudah terkunci hanya bisa diubah lewat pengajuan.
              Pengurus akan meninjau di Verifikasi.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {member.locks.email ? (
              <div className="space-y-2">
                <Label>Email baru</Label>
                <Input
                  type="email"
                  value={changeEmail}
                  onChange={(e) => setChangeEmail(e.target.value)}
                  placeholder={member.email || "email@contoh.com"}
                />
              </div>
            ) : null}
            {member.locks.nia ? (
              <div className="space-y-2">
                <Label>NIA baru</Label>
                <Input
                  value={changeNia}
                  onChange={(e) => setChangeNia(upper(e.target.value))}
                  className="font-mono uppercase"
                  placeholder={member.nia || "NIA"}
                />
              </div>
            ) : null}
            {member.locks.currentRank ? (
              <div className="space-y-2 sm:col-span-2">
                <Label>Sabuk baru</Label>
                <select
                  className={selectClassName}
                  value={changeRank}
                  onChange={(e) => setChangeRank(e.target.value)}
                >
                  <option value="">Pilih sabuk</option>
                  {beltOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {member.locks.mshNumber && showMsh ? (
              <div className="space-y-2 sm:col-span-2">
                <Label>No. MSH baru</Label>
                <Input
                  value={changeMsh}
                  onChange={(e) => setChangeMsh(upper(e.target.value))}
                  className="font-mono uppercase"
                  placeholder={member.mshNumber || "No. MSH"}
                />
              </div>
            ) : null}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="changeReason">Alasan</Label>
              <Input
                id="changeReason"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Jelaskan alasan perubahan…"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="outline"
            disabled={submittingChange}
            className="w-full gap-2"
          >
            {submittingChange ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Kirim pengajuan
          </Button>
        </form>
      ) : null}

      <DocumentPreviewDialog
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
        title={preview?.title || ""}
        url={preview?.url || null}
        proxyScope="member"
      />
    </>
  );
}
