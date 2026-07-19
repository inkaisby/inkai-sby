import Image from "next/image";

/** Ikonik Kota Surabaya: emblem resmi Suro & Boyo + tipografi lockup. */
export default function SurabayaHeroMark() {
  return (
    <div className="mb-6 inline-flex flex-col items-center gap-2.5 lg:items-start">
      <div className="flex items-center gap-3.5 sm:gap-4">
        <Image
          src="/logo-suro-boyo.png"
          alt="Lambang Kota Surabaya"
          width={72}
          height={72}
          className="h-14 w-14 object-contain drop-shadow-md sm:h-[4.5rem] sm:w-[4.5rem]"
          priority
        />
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
