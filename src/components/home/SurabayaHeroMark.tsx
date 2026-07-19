/** Ikonik Kota Surabaya: Suro & Boyo + tipografi lockup. */
export default function SurabayaHeroMark() {
  return (
    <div className="mb-6 inline-flex flex-col items-center gap-2.5 lg:items-start">
      <div className="flex items-center gap-3.5">
        <span
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-inkai-yellow/30 to-inkai-yellow/10 shadow-[0_0_24px_rgba(245,197,24,0.25)] ring-1 ring-inkai-yellow/50 sm:h-14 sm:w-14"
          aria-hidden
        >
          <SuroBoyoIcon className="h-8 w-8 text-inkai-yellow sm:h-9 sm:w-9" />
        </span>
        <div className="text-left">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-inkai-yellow/75 sm:text-[11px]">
            Kota Pahlawan
          </p>
          <p className="mt-0.5 text-2xl font-extrabold leading-none tracking-tight text-inkai-yellow drop-shadow-sm sm:text-[1.75rem]">
            Kota Surabaya
          </p>
        </div>
      </div>
      <span
        className="h-px w-32 bg-gradient-to-r from-transparent via-inkai-yellow/70 to-transparent lg:from-inkai-yellow/80 lg:via-inkai-yellow/35 lg:to-transparent"
        aria-hidden
      />
    </div>
  );
}

/** Siluet Suro (hiu) & Boyo (buaya) saling berhadapan — lambang Kota Surabaya. */
function SuroBoyoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Suro — hiu, kepala ke kanan + sirip punggung */}
      <path d="M2 34c10-2 18-1 26 4-3 2-7 3-12 3-6 0-11-2-14-7z" />
      <path d="M20 22l6 12H16l4-12z" />
      <path d="M8 36c1.5 3 2.5 5.5 3 7.5-2.5.3-4.5-.2-6-1.2.5-2 1.5-4.2 3-6.3z" opacity="0.8" />
      <circle cx="9" cy="31" r="1.4" className="fill-[var(--inkai-red)]" />

      {/* Boyo — buaya, kepala ke kiri + rahang */}
      <path d="M62 30c-10 2-18 1-26-4 3-2 7-3 12-3 6 0 11 2 14 7z" />
      <path d="M44 42l-6-12h10l-4 12z" />
      <path d="M56 28c-1.5-3-2.5-5.5-3-7.5 2.5-.3 4.5.2 6 1.2-.5 2-1.5 4.2-3 6.3z" opacity="0.8" />
      <circle cx="55" cy="33" r="1.4" className="fill-[var(--inkai-red)]" />

      {/* Titik temu */}
      <circle cx="32" cy="32" r="2.75" />
      <circle cx="32" cy="32" r="1.15" className="fill-[var(--inkai-red)]" />
    </svg>
  );
}
