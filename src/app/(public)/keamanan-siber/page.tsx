import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, ShieldCheck, Terminal, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Keamanan Siber",
  description:
    "Memahami Black Hat, White Hat, dan peran hacker dalam melindungi data anggota INKAI Surabaya.",
};

const topics = [
  {
    id: "black-hat",
    title: "Black Hat Hacker",
    subtitle: "Topi Hitam — Aksi Ilegal & Merugikan",
    icon: AlertTriangle,
    accent: "border-red-500/30 bg-red-500/5",
    iconClass: "text-red-600 bg-red-500/10",
    barClass: "bg-red-600",
    points: [
      "Menembus sistem tanpa izin untuk mencuri data, uang, atau identitas.",
      "Menyebarkan malware, ransomware, dan serangan phishing.",
      "Merusak reputasi organisasi dengan deface website atau kebocoran data.",
      "Melanggar hukum dan dapat dikenai sanksi pidana di Indonesia (UU ITE).",
    ],
  },
  {
    id: "white-hat",
    title: "White Hat Hacker",
    subtitle: "Topi Putih — Etis & Protektif",
    icon: ShieldCheck,
    accent: "border-inkai-yellow/40 bg-inkai-yellow/5",
    iconClass: "text-inkai-black bg-inkai-yellow/20",
    barClass: "bg-inkai-yellow",
    points: [
      "Melakukan penetration testing dengan izin resmi pemilik sistem.",
      "Menemukan celah keamanan sebelum disalahgunakan pihak jahat.",
      "Membantu organisasi memperkuat autentikasi, enkripsi, dan backup data.",
      "Bekerja sesuai etika profesi dan kerangka hukum yang berlaku.",
    ],
  },
  {
    id: "hacker",
    title: "Hacker",
    subtitle: "Ahli Sistem — Netral, Tergantung Niat",
    icon: Terminal,
    accent: "border-inkai-black/20 bg-inkai-black/5",
    iconClass: "text-inkai-black bg-inkai-black/10",
    barClass: "bg-inkai-black",
    points: [
      "Secara teknis, hacker adalah orang dengan keahlian mendalam di bidang komputer dan jaringan.",
      "Istilah ini netral — yang menentukan baik atau buruk adalah niat dan legalitas akses.",
      "Black hat = niat jahat; white hat = niat melindungi; grey hat = area abu-abu hukum.",
      "Di era digital INKAI, memahami perbedaan ini penting untuk melindungi data anggota.",
    ],
  },
] as const;

export default function KeamananSiberPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <Badge className="mb-4 bg-inkai-black/5 text-inkai-black hover:bg-inkai-black/5">
        Keamanan Siber
      </Badge>
      <h1 className="mb-4 text-3xl font-bold sm:text-4xl">
        Black Hat, White Hat & Hacker
      </h1>
      <p className="mb-10 max-w-2xl text-muted-foreground">
        Platform digital INKAI Surabaya menyimpan data anggota, dojo, dan
        kegiatan organisasi. Memahami peran hacker membantu kita waspada terhadap
        ancaman dan menghargai praktik keamanan yang etis.
      </p>

      <div className="space-y-6">
        {topics.map((topic) => (
          <Card
            key={topic.id}
            id={topic.id}
            className={`overflow-hidden scroll-mt-24 ${topic.accent}`}
          >
            <div className={`h-1 ${topic.barClass}`} />
            <CardContent className="p-8">
              <div className="mb-4 flex items-start gap-3">
                <div className={`rounded-xl p-3 ${topic.iconClass}`}>
                  <topic.icon className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{topic.title}</h2>
                  <p className="text-sm text-muted-foreground">{topic.subtitle}</p>
                </div>
              </div>
              <ul className="space-y-3">
                {topic.points.map((point) => (
                  <li
                    key={point}
                    className="flex gap-3 text-muted-foreground leading-relaxed"
                  >
                    <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-inkai-red" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8 overflow-hidden border-inkai-red/20">
        <div className="h-1 bg-inkai-red" />
        <CardContent className="p-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-inkai-red/10 p-3">
              <Shield className="h-6 w-6 text-inkai-red" />
            </div>
            <h2 className="text-xl font-bold">
              Komitmen Keamanan INKAI Surabaya
            </h2>
          </div>
          <ul className="space-y-2 text-muted-foreground">
            <li>• Rate limiting login/daftar/API (Upstash bila dikonfigurasi; fallback memori per instance).</li>
            <li>• Validasi input (Zod) dan kebijakan password kuat pada registrasi & reset.</li>
            <li>• Blokir akun PENDING sampai admin menyetujui pendaftaran.</li>
            <li>• Pendaftaran hanya untuk dojo Cabang Surabaya.</li>
            <li>• Security headers (CSP, HSTS, X-Frame-Options) di setiap halaman.</li>
            <li>• CSRF same-origin ketat pada mutasi `/api/admin/*`; auth memakai pemeriksaan Origin/Referer longgar.</li>
            <li>• RBAC wilayah + cek partisipan pesan; verifikasi gagal API tidak di-approve lokal.</li>
            <li>• Data anggota di Supabase PostgreSQL dengan enkripsi koneksi SSL.</li>
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            Proteksi terus diperkuat. Laporkan aktivitas mencurigakan melalui pengurus
            cabang atau admin dojo. White hat dengan izin resmi tetap dihormati.
          </p>
        </CardContent>
      </Card>

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        {topics.map((topic) => (
          <Link
            key={topic.id}
            href={`#${topic.id}`}
            className="rounded-full border px-4 py-1.5 font-medium transition-colors hover:bg-muted"
          >
            {topic.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
