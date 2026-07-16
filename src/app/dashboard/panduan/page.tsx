import { MemberPageHeader } from "@/components/member/MemberPageHeader";
import {
  FALLBACK_MEMBER_GUIDE,
  fetchMemberGuideResolved,
} from "@/lib/memberGuide";

export const dynamic = "force-dynamic";

export default async function PanduanPage() {
  const guide =
    (await fetchMemberGuideResolved().catch(() => FALLBACK_MEMBER_GUIDE)) ??
    FALLBACK_MEMBER_GUIDE;

  return (
    <>
      <MemberPageHeader title="Panduan" />
      <div className="member-fade-in space-y-4">
        <div>
          <h2 className="text-lg font-extrabold">{guide.title}</h2>
          {guide.subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">{guide.subtitle}</p>
          ) : null}
        </div>
        {guide.items.map((item) => (
          <div
            key={item.heading}
            className="rounded-2xl border border-border/60 bg-card p-4"
          >
            <p className="font-bold">{item.heading}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
          </div>
        ))}
        {guide.footer ? (
          <p className="text-xs text-muted-foreground">{guide.footer}</p>
        ) : null}
      </div>
    </>
  );
}
