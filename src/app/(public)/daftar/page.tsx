"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Dojo = { id: string; nama: string; cabang: { nama: string } };

function DaftarForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedDojo = searchParams.get("dojo") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nik, setNik] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [gender, setGender] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [dojoId, setDojoId] = useState(preselectedDojo);
  const [dojos, setDojos] = useState<Dojo[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/dojos")
      .then((r) => r.json())
      .then(setDojos)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (preselectedDojo) setDojoId(preselectedDojo);
  }, [preselectedDojo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

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

    setSuccess(data.message || "Pendaftaran berhasil!");
    setTimeout(() => router.push("/login"), 2000);
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="text-center">
        <Image
          src="/logo-inkai.png"
          alt="Logo INKAI"
          width={72}
          height={72}
          className="mx-auto mb-2 rounded-full"
        />
        <CardTitle className="text-2xl">Pendaftaran Anggota</CardTitle>
        <CardDescription>Daftar sebagai anggota INKAI Surabaya</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nama Lengkap</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nik">NIK</Label>
              <Input
                id="nik"
                value={nik}
                onChange={(e) => setNik(e.target.value)}
                placeholder="16 digit"
                pattern="\d{16}"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telepon</Label>
              <Input
                id="phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
              />
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
              <Label htmlFor="birthDate">Tanggal Lahir</Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <p className="text-xs text-muted-foreground">
              Minimal 8 karakter, kombinasi huruf dan angka
            </p>
          </div>
          <div className="space-y-2">
            <Label>Dojo/Ranting (Cabang Surabaya)</Label>
            <Select value={dojoId} onValueChange={setDojoId} required>
              <SelectTrigger>
                <SelectValue placeholder="Pilih dojo/ranting" />
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
          <Button
            type="submit"
            className="w-full bg-inkai-red hover:bg-inkai-red/90"
            disabled={loading || !dojoId}
          >
            {loading ? "Memproses..." : "Daftar"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Sudah punya akun?{" "}
          <Link href="/login" className="font-medium text-inkai-red hover:underline">
            Masuk di sini
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function DaftarPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <Suspense>
        <DaftarForm />
      </Suspense>
    </div>
  );
}
