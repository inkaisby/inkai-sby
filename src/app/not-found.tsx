import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="mb-2 text-6xl font-bold text-inkai-red">404</p>
      <h1 className="mb-2 text-2xl font-bold">Halaman Tidak Ditemukan</h1>
      <p className="mb-6 max-w-md text-muted-foreground">
        Halaman yang Anda cari tidak ada atau telah dipindahkan.
      </p>
      <Button asChild className="bg-inkai-red hover:bg-inkai-red/90">
        <Link href="/">Kembali ke Beranda</Link>
      </Button>
    </div>
  );
}
