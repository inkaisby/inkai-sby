import Link from "next/link";
import Image from "next/image";

export default function PublicFooter() {
  return (
    <footer className="border-t bg-inkai-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-3">
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
              <Link href="/sejarah" className="hover:text-white">
                Sejarah
              </Link>
              <Link href="/makna-lambang" className="hover:text-white">
                Makna Lambang
              </Link>
              <Link href="/struktur" className="hover:text-white">
                Struktur Organisasi
              </Link>
              <Link href="/visi-misi" className="hover:text-white">
                Visi & Misi
              </Link>
            </nav>
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
