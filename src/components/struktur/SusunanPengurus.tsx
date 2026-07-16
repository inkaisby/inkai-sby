import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { PersonEntry, PengurusPeriod } from "@/lib/struktur-pengurus";
import {
  Building2,
  ChevronRight,
  Crown,
  ExternalLink,
  FileText,
  Phone,
  Shield,
  Users,
} from "lucide-react";

function PersonBlock({
  person,
  large = false,
}: {
  person: PersonEntry;
  large?: boolean;
}) {
  return (
    <div className={`flex ${large ? "flex-col items-center text-center" : "items-start gap-3"}`}>
      {person.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.photoUrl}
          alt={person.name}
          className={`shrink-0 rounded-full object-cover ${large ? "mb-2 h-20 w-20" : "h-10 w-10"}`}
        />
      ) : null}
      <div className={large ? "" : "min-w-0"}>
        <p className={`font-medium leading-snug text-foreground ${large ? "text-lg font-bold" : ""}`}>
          {person.name}
        </p>
        {(person.phone || person.email) && (
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {person.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {person.phone}
              </span>
            )}
            {person.email && <span>{person.email}</span>}
          </p>
        )}
      </div>
    </div>
  );
}

function RoleCard({
  role,
  person,
}: {
  role: string;
  person: PersonEntry;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-inkai-red">
        {role}
      </p>
      <PersonBlock person={person} />
    </div>
  );
}

function MemberList({ members }: { members: readonly PersonEntry[] }) {
  return (
    <ul className="space-y-2">
      {members.map((member, index) => (
        <li key={`${member.name}-${index}`} className="flex items-start gap-2 text-sm">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-inkai-red/60" />
          <PersonBlock person={member} />
        </li>
      ))}
    </ul>
  );
}

export default function SusunanPengurus({
  pengurus,
  showPrintHint = false,
}: {
  pengurus: PengurusPeriod;
  showPrintHint?: boolean;
}) {
  const { periode, pelindung, penasihat, inti, bidang, document } = pengurus;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-center gap-2 text-sm print:hidden">
        {["Pusat (Nasional)", "Provinsi Jatim", "Cabang Surabaya"].map(
          (level, i) => (
            <div key={level} className="flex items-center gap-2">
              <span className="rounded-full bg-inkai-red/10 px-3 py-1 font-medium text-inkai-red">
                {level}
              </span>
              {i < 2 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          ),
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-inkai-red/20 bg-gradient-to-br from-inkai-red/5 via-background to-inkai-yellow/5 px-6 py-8 text-center sm:px-10">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-inkai-red/5 blur-2xl print:hidden" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-inkai-yellow/10 blur-2xl print:hidden" />
        <div className="relative">
          <Badge className="mb-4 bg-inkai-red/10 text-inkai-red hover:bg-inkai-red/10">
            Periode {periode}
          </Badge>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            Susunan Pengurus Kota INKAI Surabaya
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Institut Karate-Do Indonesia — Cabang Surabaya
          </p>
          {document?.number && (
            <p className="mt-3 text-xs text-muted-foreground">
              {document.title ? `${document.title} · ` : ""}
              {document.number}
              {document.date ? ` · ${document.date}` : ""}
            </p>
          )}
          {document?.url && (
            <a
              href={document.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-inkai-red hover:underline print:hidden"
            >
              <FileText className="h-4 w-4" />
              Lihat dokumen SK
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {showPrintHint && (
            <p className="mt-2 text-xs text-muted-foreground print:hidden">
              Gunakan Cetak / Export PDF dari tombol di atas.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-inkai-yellow/30 bg-inkai-yellow/5 p-5 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <Shield className="h-4 w-4 text-inkai-yellow" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pelindung
          </p>
        </div>
        <p className="font-semibold">{pelindung}</p>
      </div>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Penasihat
          </h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {penasihat.map((p, index) => (
            <RoleCard key={`${p.name}-${index}`} role="Penasihat" person={p} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-inkai-red" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pengurus Inti
          </h3>
        </div>

        <div className="relative mx-auto mb-5 max-w-xl">
          <Card className="border-inkai-red/30 bg-gradient-to-b from-inkai-red/5 to-background shadow-md">
            <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-inkai-red/10">
                <Crown className="h-5 w-5 text-inkai-red" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-inkai-red">
                Ketua
              </p>
              <PersonBlock person={inti.ketua} large />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <RoleCard role="Koordinator MSH" person={inti.koordinatorMsh} />
          <RoleCard role="Wakil Ketua" person={inti.wakilKetua} />
          <RoleCard role="Sekretaris" person={inti.sekretaris} />
          <RoleCard role="Bendahara" person={inti.bendahara} />
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Bidang & Seksi
        </h3>
        <div className="grid gap-4 lg:grid-cols-2">
          {bidang.map((item) => (
            <Card
              key={item.id}
              className="overflow-hidden border-border/60 bg-card/50"
            >
              <CardContent className="p-0">
                <div className="border-b border-inkai-red/10 bg-muted/40 px-5 py-3">
                  <p className="font-semibold text-foreground">{item.title}</p>
                  {item.head && (
                    <div className="mt-2 text-sm text-inkai-red">
                      <PersonBlock person={item.head} />
                    </div>
                  )}
                </div>
                <div className="space-y-4 px-5 py-4">
                  {item.members && item.members.length > 0 && (
                    <MemberList members={item.members} />
                  )}
                  {item.seksi?.map((seksi) => (
                    <div
                      key={seksi.id}
                      className="rounded-lg border-l-2 border-inkai-yellow/60 bg-muted/30 py-2 pl-4 pr-2"
                    >
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {seksi.title}
                      </p>
                      <MemberList members={seksi.members} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
