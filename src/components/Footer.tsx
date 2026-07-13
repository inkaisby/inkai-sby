export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink-950 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div>
            <p className="text-lg font-bold text-white">
              Inkai<span className="text-accent">SBY</span>
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              Surabaya, Jawa Timur, Indonesia
            </p>
          </div>
          <p className="text-sm text-zinc-500">
            © {new Date().getFullYear()} Inkai SBY. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
