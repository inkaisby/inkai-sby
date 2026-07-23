import Link from "next/link";
import Image from "next/image";
import { SITE_CONTACT } from "@/lib/site";

export default function PublicFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-inkai-black text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_10%_0%,rgba(200,16,46,0.22),transparent_55%),radial-gradient(ellipse_50%_40%_at_90%_100%,rgba(245,197,24,0.1),transparent_50%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14">
        <div className="grid gap-10 md:grid-cols-4 md:gap-8">
          <div className="flex flex-col items-start gap-3">
            <Image
              src="/logo-inkai.png"
              alt="Logo INKAI"
              width={64}
              height={64}
              className="rounded-full shadow-lg ring-2 ring-white/15"
            />
            <p className="font-semibold tracking-tight">INKAI Surabaya</p>
            <p className="text-sm leading-relaxed text-white/65">
              Institut Karate-Do Indonesia
              <br />
              Cabang Surabaya, Jawa Timur
            </p>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-inkai-yellow">
              Navigasi
            </p>
            <nav className="flex flex-col gap-2 text-sm text-white/65">
              <Link href="/sejarah" prefetch className="transition-colors hover:text-white">
                Sejarah
              </Link>
              <Link href="/makna-lambang" prefetch className="transition-colors hover:text-white">
                Makna Lambang
              </Link>
              <Link href="/struktur" prefetch className="transition-colors hover:text-white">
                Struktur Organisasi
              </Link>
              <Link href="/visi-misi" prefetch className="transition-colors hover:text-white">
                Visi & Misi
              </Link>
              <Link href="/kegiatan" prefetch className="transition-colors hover:text-white">
                Kegiatan
              </Link>
              <Link href="/berita" prefetch className="transition-colors hover:text-white">
                Berita
              </Link>
              <Link href="/kontak" prefetch className="transition-colors hover:text-white">
                Kontak
              </Link>
            </nav>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-inkai-yellow">
              Kontak
            </p>
            <div className="flex flex-col gap-2 text-sm text-white/65">
              <Link
                href={`https://wa.me/${SITE_CONTACT.whatsapp}`}
                target="_blank"
                className="transition-colors hover:text-white"
              >
                {SITE_CONTACT.phone} (WA)
              </Link>
              <Link
                href={`mailto:${SITE_CONTACT.email}`}
                className="transition-colors hover:text-white"
              >
                {SITE_CONTACT.email}
              </Link>
            </div>
          </div>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-inkai-yellow">
              Motto INKAI
            </p>
            <p className="text-sm italic leading-relaxed text-white/75">
              &ldquo;Karate-Ka INKAI senantiasa memiliki Integritas tinggi,
              Tangguh dan Rendah Hati&rdquo;
            </p>
          </div>
        </div>
        <div className="mt-10 border-t border-white/10 pt-6 text-center text-sm text-white/45">
          © {new Date().getFullYear()} INKAI Surabaya. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
