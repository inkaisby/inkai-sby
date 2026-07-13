import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, MapPin, Phone, Clock, MessageCircle } from "lucide-react";
import { SITE_CONTACT } from "@/lib/site";

export const metadata: Metadata = {
  title: "Kontak",
  description: "Hubungi INKAI Cabang Surabaya — alamat, telepon, WhatsApp, dan email.",
};

export default function KontakPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <Badge className="mb-4 bg-inkai-red/10 text-inkai-red hover:bg-inkai-red/10">
        Kontak
      </Badge>
      <h1 className="mb-4 text-3xl font-bold sm:text-4xl">Hubungi INKAI Surabaya</h1>
      <p className="mb-10 max-w-2xl text-muted-foreground">
        Tim pengurus Cabang Surabaya siap membantu informasi pendaftaran, kegiatan,
        dan administrasi keanggotaan.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex gap-3 p-6">
            <MapPin className="h-5 w-5 text-inkai-red shrink-0" />
            <div>
              <p className="font-semibold">Alamat Sekretariat</p>
              <p className="text-sm text-muted-foreground">{SITE_CONTACT.address}</p>
              <Link
                href={SITE_CONTACT.mapsUrl}
                target="_blank"
                className="mt-2 inline-block text-sm text-inkai-red hover:underline"
              >
                Buka di Google Maps →
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex gap-3 p-6">
            <Phone className="h-5 w-5 text-inkai-red shrink-0" />
            <div>
              <p className="font-semibold">Telepon</p>
              <p className="text-sm text-muted-foreground">{SITE_CONTACT.phone}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex gap-3 p-6">
            <MessageCircle className="h-5 w-5 text-inkai-red shrink-0" />
            <div>
              <p className="font-semibold">WhatsApp</p>
              <Link
                href={`https://wa.me/${SITE_CONTACT.whatsapp}`}
                target="_blank"
                className="text-sm text-inkai-red hover:underline"
              >
                Chat via WhatsApp
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex gap-3 p-6">
            <Mail className="h-5 w-5 text-inkai-red shrink-0" />
            <div>
              <p className="font-semibold">Email</p>
              <Link
                href={`mailto:${SITE_CONTACT.email}`}
                className="text-sm text-inkai-red hover:underline"
              >
                {SITE_CONTACT.email}
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2">
          <CardContent className="flex gap-3 p-6">
            <Clock className="h-5 w-5 text-inkai-red shrink-0" />
            <div>
              <p className="font-semibold">Jam Operasional Sekretariat</p>
              <p className="text-sm text-muted-foreground">{SITE_CONTACT.hours}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
