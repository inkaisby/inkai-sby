import Link from "next/link";
import Image from "next/image";
import { SITE_CONTACT } from "@/lib/site";

export default function PublicFooter() {
  return (
    <footer className="border-t bg-inkai-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="flex flex-col items-start gap-3">
            <Image
              src="/logo-inkai.png"
              alt="Logo INKAI"
              width={64}
              height={64}
              className="rounded-full"
            />
            <p className="font-bold">INKAI Surabaya</p>
            <p className="text-sm text-white/70">
              Institut Karate-Do Indonesia
              <br />
              Cabang Surabaya, Jawa Timur
            </p>
          </div>
          <div>
            <p className="mb-3 font-semibold text-inkai-yellow">Navigasi</p>
            <nav className="flex flex-col gap-2 text-sm text-white/70">
              <Link href="/sejarah" prefetch className="hover:text-white">
                Sejarah
              </Link>
              <Link href="/makna-lambang" prefetch className="hover:text-white">
                Makna Lambang
              </Link>
              <Link href="/struktur" prefetch className="hover:text-white">
                Struktur Organisasi
              </Link>
              <Link href="/visi-misi" prefetch className="hover:text-white">
                Visi & Misi
              </Link>
              <Link href="/kegiatan" prefetch className="hover:text-white">
                Kegiatan
              </Link>
              <Link href="/berita" prefetch className="hover:text-white">
                Berita
              </Link>
              <Link href="/kontak" prefetch className="hover:text-white">
                Kontak
              </Link>
            </nav>
          </div>
          <div>
            <p className="mb-3 font-semibold text-inkai-yellow">Kontak</p>
            <div className="flex flex-col gap-2 text-sm text-white/70">
              <Link
                href={`https://wa.me/${SITE_CONTACT.whatsapp}`}
                target="_blank"
                className="hover:text-white"
              >
                {SITE_CONTACT.phone} (WA)
              </Link>
              <Link href={`mailto:${SITE_CONTACT.email}`} className="hover:text-white">
                {SITE_CONTACT.email}
              </Link>
            </div>
          </div>
          <div>
            <p className="mb-3 font-semibold text-inkai-yellow">Motto INKAI</p>
            <p className="text-sm italic leading-relaxed text-white/80">
              &ldquo;Karate-Ka INKAI senantiasa memiliki Integritas tinggi,
              Tangguh dan Rendah Hati&rdquo;
            </p>
          </div>
        </div>
        <div className="mt-8 border-t border-white/10 pt-6 text-center text-sm text-white/50">
          © {new Date().getFullYear()} INKAI Surabaya. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
