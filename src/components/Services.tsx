const services = [
  {
    title: "Website Development",
    description:
      "Website responsif, cepat, dan SEO-friendly dibangun dengan teknologi modern seperti Next.js.",
    icon: "🌐",
  },
  {
    title: "UI/UX Design",
    description:
      "Desain antarmuka yang intuitif dan menarik untuk meningkatkan pengalaman pengguna.",
    icon: "🎨",
  },
  {
    title: "Branding Digital",
    description:
      "Identitas visual dan strategi brand yang kuat untuk membedakan bisnis Anda.",
    icon: "✨",
  },
  {
    title: "Maintenance & Support",
    description:
      "Pemeliharaan berkala dan dukungan teknis agar website Anda selalu optimal.",
    icon: "🔧",
  },
];

export default function Services() {
  return (
    <section id="layanan" className="bg-ink-950 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-accent">
            Layanan Kami
          </p>
          <h2 className="text-3xl font-bold text-white md:text-4xl">
            Solusi untuk Setiap Kebutuhan
          </h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <div
              key={service.title}
              className="group rounded-2xl border border-white/10 bg-ink-900/50 p-6 transition-colors hover:border-accent/30 hover:bg-ink-900"
            >
              <span className="text-3xl" role="img" aria-hidden="true">
                {service.icon}
              </span>
              <h3 className="mt-4 mb-2 text-lg font-semibold text-white">
                {service.title}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
