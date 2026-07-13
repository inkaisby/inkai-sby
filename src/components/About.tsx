export default function About() {
  return (
    <section id="tentang" className="bg-ink-900 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium uppercase tracking-widest text-accent">
              Tentang Kami
            </p>
            <h2 className="mb-6 text-3xl font-bold text-white md:text-4xl">
              Partner Digital Terpercaya di Surabaya
            </h2>
            <p className="mb-4 leading-relaxed text-zinc-400">
              Inkai SBY adalah tim profesional yang berdedikasi membantu
              bisnis lokal dan nasional tumbuh melalui solusi digital yang
              tepat sasaran.
            </p>
            <p className="leading-relaxed text-zinc-400">
              Dari website perusahaan hingga strategi digital, kami
              menghadirkan karya berkualitas dengan pendekatan yang personal
              dan transparan.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { value: "50+", label: "Proyek Selesai" },
              { value: "30+", label: "Klien Puas" },
              { value: "5+", label: "Tahun Pengalaman" },
              { value: "24/7", label: "Dukungan" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/10 bg-ink-950/50 p-6 text-center"
              >
                <p className="text-3xl font-bold text-accent">{stat.value}</p>
                <p className="mt-1 text-sm text-zinc-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
