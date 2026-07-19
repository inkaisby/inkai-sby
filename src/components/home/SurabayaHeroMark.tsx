import Image from "next/image";

/** Ikonik Kota Surabaya: logo Suro & Boyo + tipografi lockup. */
export default function SurabayaHeroMark() {
  return (
    <div className="mb-6 inline-flex flex-col items-center gap-2.5 lg:items-start">
      <div className="flex items-center gap-3.5 sm:gap-4">
        <span
          className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] shadow-[0_0_28px_rgba(245,197,24,0.35)] ring-[3px] ring-inkai-yellow sm:h-[4.75rem] sm:w-[4.75rem] sm:ring-4"
          aria-hidden
        >
          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-inkai-yellow/25 via-transparent to-inkai-red/20" />
          <Image
            src="/logo-suro-boyo.png"
            alt=""
            width={80}
            height={80}
            className="relative z-[1] h-[88%] w-[88%] object-contain"
            priority
          />
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
        className="h-px w-36 bg-gradient-to-r from-transparent via-inkai-yellow/70 to-transparent lg:from-inkai-yellow/80 lg:via-inkai-yellow/35 lg:to-transparent"
        aria-hidden
      />
    </div>
  );
}
