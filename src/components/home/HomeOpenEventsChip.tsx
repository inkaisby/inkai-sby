import { listOpenOrOngoingEventsForPublic } from "@/lib/open-events";
import { OpenEventsFloatingChip } from "@/components/home/OpenEventsFloatingChip";

/** Server wrapper — fetch cached; empty → null (tidak blok first paint via Suspense). */
export default async function HomeOpenEventsChip() {
  const events = await listOpenOrOngoingEventsForPublic(5);
  if (events.length === 0) return null;
  return <OpenEventsFloatingChip initialEvents={events} />;
}
