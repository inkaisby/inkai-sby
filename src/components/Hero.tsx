export default function Hero() {
  return (
    <section
      id="beranda"
      className="relative flex min-h-screen items-center justify-center overflow-hidden pt-16"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-ink-950 via-ink-900 to-ink-950" />
      <div className="absolute inset-0 opacity-20">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 text-center">
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-accent">
          Surabaya, Indonesia
        </p>
        <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight text-white md:text-7xl">
          Inkai<span className="text-accent">SBY</span>
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-zinc-300 md:text-xl">
          Solusi digital modern untuk bisnis Anda. Kami membantu mewujudkan
          kehadiran online yang profesional dan berdampak.
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#layanan"
            className="rounded-full bg-accent px-8 py-3 text-base font-semibold text-ink-950 transition-opacity hover:opacity-90"
          >
            Lihat Layanan
          </a>
          <a
            href="#kontak"
            className="rounded-full border border-white/20 px-8 py-3 text-base font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/5"
          >
            Hubungi Kami
          </a>
        </div>
      </div>
    </section>
  );
}
