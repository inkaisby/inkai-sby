"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Lock,
  Phone,
  CreditCard,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
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

type Dojo = { id: string; nama: string; cabang: { nama: string } };

type RegisterFormProps = {
  preselectedDojo?: string;
};

export default function RegisterForm({ preselectedDojo = "" }: RegisterFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [nik, setNik] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [gender, setGender] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [dojoId, setDojoId] = useState(preselectedDojo);
  const [dojos, setDojos] = useState<Dojo[]>([]);
  const [dojosLoading, setDojosLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/dojos")
      .then((r) => r.json())
      .then((data) => setDojos(Array.isArray(data) ? data : []))
      .catch(() => setError("Gagal memuat daftar dojo dari database"))
      .finally(() => setDojosLoading(false));
  }, []);

  useEffect(() => {
    if (preselectedDojo) setDojoId(preselectedDojo);
  }, [preselectedDojo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak cocok");
      return;
    }

    if (!dojoId) {
      setError("Pilih dojo/ranting terlebih dahulu");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        dojoId,
        nik,
        phoneNumber,
        gender,
        birthDate,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Pendaftaran gagal");
      return;
    }

    setSuccess(
      data.message ||
        "Pendaftaran berhasil! Akun Anda menunggu verifikasi admin sebelum bisa login."
    );
    setTimeout(() => router.push("/login"), 2500);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-inkai-red">
          Data Pribadi
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="register-name">Nama Lengkap</Label>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="register-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="pl-9"
            placeholder="Nama sesuai KTP"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="register-nik">NIK</Label>
          <div className="relative">
            <CreditCard className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="register-nik"
              value={nik}
              onChange={(e) => setNik(e.target.value)}
              className="pl-9"
              placeholder="16 digit"
              pattern="\d{16}"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-phone">Telepon / WA</Label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="register-phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="pl-9"
              placeholder="08xxxxxxxxxx"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Jenis Kelamin</Label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="L">Laki-laki</SelectItem>
              <SelectItem value="P">Perempuan</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="register-birth">Tanggal Lahir</Label>
          <Input
            id="register-birth"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1 pt-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-inkai-red">
          Akun
        </p>
      </div>

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

      <div className="space-y-1 pt-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-inkai-red">
          Dojo / Ranting
        </p>
      </div>

      <div className="space-y-2">
        <Label>Dojo/Ranting (Cabang Surabaya)</Label>
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
        disabled={loading || dojosLoading || !dojoId}
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
