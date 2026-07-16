import type { PengurusPeriod, PersonEntry } from "@/lib/struktur-pengurus";

function cleanPerson(p: PersonEntry): PersonEntry {
  return {
    name: p.name.trim(),
    photoUrl: p.photoUrl?.trim() || undefined,
    phone: p.phone?.trim() || undefined,
    email: p.email?.trim() || undefined,
  };
}

/** Strip empty optional fields before Zod validation. */
export function preparePeriodForSave(period: PengurusPeriod): PengurusPeriod {
  return {
    ...period,
    periode: period.periode.trim(),
    pelindung: period.pelindung.trim(),
    penasihat: period.penasihat.map(cleanPerson),
    inti: {
      ketua: cleanPerson(period.inti.ketua),
      koordinatorMsh: cleanPerson(period.inti.koordinatorMsh),
      wakilKetua: cleanPerson(period.inti.wakilKetua),
      sekretaris: cleanPerson(period.inti.sekretaris),
      bendahara: cleanPerson(period.inti.bendahara),
    },
    bidang: period.bidang.map((b) => ({
      ...b,
      title: b.title.trim(),
      head: b.head ? cleanPerson(b.head) : undefined,
      members: b.members?.map(cleanPerson),
      seksi: b.seksi?.map((s) => ({
        ...s,
        title: s.title.trim(),
        members: s.members.map(cleanPerson),
      })),
    })),
    document: period.document
      ? {
          title: period.document.title?.trim() || undefined,
          number: period.document.number?.trim() || undefined,
          date: period.document.date?.trim() || undefined,
          url: period.document.url?.trim() || undefined,
        }
      : undefined,
    updatedAt: new Date().toISOString(),
  };
}
