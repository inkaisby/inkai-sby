import { listOpenOrOngoingEventsForPublic } from "@/lib/open-events";
import { OpenEventsFloatingChip } from "@/components/home/OpenEventsFloatingChip";

/** Server wrapper — fetch cached; empty/DB gagal → null (jangan jatuhkan layout publik). */
export default async function HomeOpenEventsChip() {
  try {
    const events = await listOpenOrOngoingEventsForPublic(5);
    if (events.length === 0) return null;
    return <OpenEventsFloatingChip initialEvents={events} />;
  } catch (error) {
    console.error("[HomeOpenEventsChip]", error);
    return null;
  }
}
