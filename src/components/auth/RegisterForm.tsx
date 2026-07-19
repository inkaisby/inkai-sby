"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MemberBeltSection,
  MemberIdentitySection,
  type MemberFormFields,
  type MemberFormSuggestion,
  validateMemberFormFields,
} from "@/components/member/MemberFormSections";
import { DEFAULT_MEMBER_RANK } from "@/lib/belt";
import { showError, showSuccess } from "@/lib/client-toast";

type Dojo = { id: string; nama: string; cabang: { nama: string } };

type RegisterFormProps = {
  preselectedDojo?: string;
};

const emptyMemberFields = (): MemberFormFields => ({
  fullName: "",
  gender: "",
  birthPlace: "",
  birthDate: "",
  address: "",
  nik: "",
  nia: "",
  phoneNumber: "",
  currentRank: DEFAULT_MEMBER_RANK,
});

export default function RegisterForm({ preselectedDojo = "" }: RegisterFormProps) {
  const router = useRouter();
  const [memberFields, setMemberFields] = useState<MemberFormFields>(emptyMemberFields);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [dojoId, setDojoId] = useState(preselectedDojo);
  const [dojos, setDojos] = useState<Dojo[]>([]);
  const [dojosLoading, setDojosLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<MemberFormSuggestion[]>([]);
  const [duplicateBlocked, setDuplicateBlocked] = useState(false);

  useEffect(() => {
    fetch("/api/dojos")
      .then((r) => r.json())
      .then((data) => setDojos(Array.isArray(data?.data) ? data.data : []))
      .catch(() => setError("Gagal memuat daftar dojo dari database"))
      .finally(() => setDojosLoading(false));
  }, []);

  useEffect(() => {
    if (preselectedDojo) setDojoId(preselectedDojo);
  }, [preselectedDojo]);

  useEffect(() => {
    const q = memberFields.fullName.trim();
    const nik = memberFields.nik.trim();
    const nia = memberFields.nia.trim();
    const birthDate = memberFields.birthDate.trim();
    if (q.length < 3 && nik.length < 16 && nia.length < 2) {
      setSuggestions([]);
      setDuplicateBlocked(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/auth/register/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: q || undefined,
            birthDate: birthDate || undefined,
            nik: nik || undefined,
            nia: nia || undefined,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          suggestions?: MemberFormSuggestion[];
          blocked?: boolean;
        };
        setSuggestions(data.suggestions ?? []);
        setDuplicateBlocked(Boolean(data.blocked));
      } catch {
        setSuggestions([]);
        setDuplicateBlocked(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [
    memberFields.fullName,
    memberFields.birthDate,
    memberFields.nik,
    memberFields.nia,
  ]);

  function setMemberField<K extends keyof MemberFormFields>(
    key: K,
    value: MemberFormFields[K],
  ) {
    setMemberFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validateMemberFormFields(memberFields, {
      requireCompleteIdentity: true,
    });
    if (validationError) {
      setError(validationError);
      showError(validationError);
      return;
    }

    if (duplicateBlocked) {
      const msg =
        "Data terindikasi duplikat. Jika sudah didaftarkan ranting, hubungi pengurus — jangan daftar ulang.";
      setError(msg);
      showError(msg);
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak cocok");
      showError("Konfirmasi password tidak cocok");
      return;
    }

    if (!dojoId) {
      setError("Pilih dojo/ranting terlebih dahulu");
      showError("Pilih dojo/ranting terlebih dahulu");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: memberFields.fullName.trim(),
          email,
          password,
          dojoId,
          nik: memberFields.nik.trim(),
          nia: memberFields.nia.trim() || undefined,
          phoneNumber: memberFields.phoneNumber.trim(),
          gender: memberFields.gender,
          birthPlace: memberFields.birthPlace.trim(),
          birthDate: memberFields.birthDate,
          address: memberFields.address.trim(),
          currentRank: memberFields.currentRank || DEFAULT_MEMBER_RANK,
        }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Pendaftaran gagal");
      showError(data.error || "Pendaftaran gagal");
      return;
    }

    const successMsg =
      data.message ||
      "Pendaftaran berhasil! Akun Anda menunggu verifikasi admin sebelum bisa login.";
    setSuccess(successMsg);
    showSuccess(successMsg);
    setTimeout(() => router.push("/login"), 2500);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <MemberIdentitySection
        idPrefix="register"
        form={memberFields}
        onChange={setMemberField}
        suggestions={suggestions}
        duplicateBlocked={duplicateBlocked}
        requireCompleteIdentity
      />

      <MemberBeltSection
        idPrefix="register"
        form={memberFields}
        onChange={setMemberField}
      />

      <section className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Akun
        </h3>

        <div className="space-y-2">
          <Label htmlFor="register-email">Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9"
              placeholder="nama@email.com"
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="register-password">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="register-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 pr-10"
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="register-confirm">Konfirmasi Password</Label>
            <Input
              id="register-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Minimal 8 karakter, kombinasi huruf dan angka.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Dojo
        </h3>

        <div className="space-y-2">
          <Label>Dojo / Ranting (Cabang Surabaya)</Label>
          <Select
            value={dojoId}
            onValueChange={setDojoId}
            disabled={dojosLoading}
            required
          >
            <SelectTrigger>
              <SelectValue
                placeholder={dojosLoading ? "Memuat dojo..." : "Pilih dojo/ranting"}
              />
            </SelectTrigger>
            <SelectContent>
              {dojos.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {error && (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 text-sm text-green-700 dark:text-green-400">
          {success}
        </p>
      )}

      <Button
        type="submit"
        className="h-11 w-full rounded-xl bg-inkai-red text-base font-semibold hover:bg-inkai-red/90"
        disabled={loading || dojosLoading || !dojoId || duplicateBlocked}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Memproses...
          </>
        ) : (
          "Daftar Anggota"
        )}
      </Button>
    </form>
  );
}
