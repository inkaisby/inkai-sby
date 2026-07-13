export default function Contact() {
  return (
    <section id="kontak" className="bg-ink-900 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-accent">
            Kontak
          </p>
          <h2 className="mb-6 text-3xl font-bold text-white md:text-4xl">
            Mari Bekerja Sama
          </h2>
          <p className="mb-10 text-zinc-400">
            Siap mewujudkan proyek digital Anda? Hubungi kami untuk konsultasi
            gratis.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href="mailto:hello@inkai-sby.com"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3 font-semibold text-ink-950 transition-opacity hover:opacity-90"
            >
              hello@inkai-sby.com
            </a>
            <a
              href="https://wa.me/6281234567890"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-8 py-3 font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/5"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
