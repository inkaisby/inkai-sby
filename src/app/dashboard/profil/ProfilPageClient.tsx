"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { showError, showSuccess } from "@/lib/client-toast";

export default function ProfilPageClient({
  member,
}: {
  member: {
    id: string;
    fullName: string;
    nik: string | null;
    gender: string | null;
    birthDate: Date | null;
    address: string | null;
    phoneNumber?: string | null;
  };
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(member.fullName);
  const [address, setAddress] = useState(member.address || "");
  const [phoneNumber, setPhoneNumber] = useState(member.phoneNumber || "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/member/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, address, phoneNumber }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      showSuccess(data.message || "Profil berhasil diperbarui");
      router.refresh();
    } else {
      showError(data.error || "Gagal memperbarui profil");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil Anggota</CardTitle>
        <CardDescription>Perbarui data pribadi Anda</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
          <div className="space-y-2">
            <Label>Nama Lengkap</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>NIK</Label>
            <Input value={member.nik || "-"} disabled />
          </div>
          <div className="space-y-2">
            <Label>Telepon</Label>
            <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Alamat</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading} className="bg-inkai-red hover:bg-inkai-red/90">
            Simpan Perubahan
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href="/lupa-password" className="text-inkai-red hover:underline">
            Ubah password
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
