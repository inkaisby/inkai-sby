"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintButton({ autoPrint = false }: { autoPrint?: boolean }) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, [autoPrint]);

  return (
    <Button
      type="button"
      className="bg-inkai-red hover:bg-inkai-red/90"
      onClick={() => window.print()}
    >
      <Printer className="mr-2 h-4 w-4" />
      Cetak / Simpan PDF
    </Button>
  );
}
