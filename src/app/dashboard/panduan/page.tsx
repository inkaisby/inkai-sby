import { MemberPageHeader } from "@/components/member/MemberPageHeader";
import { TutorialSections } from "@/components/tutorial/TutorialSections";
import { getMemberTutorials } from "@/lib/memberTutorials";

export const dynamic = "force-dynamic";

export default function PanduanPage() {
  const tutorials = getMemberTutorials();

  return (
    <>
      <MemberPageHeader title="Panduan" />
      <div className="member-fade-in space-y-4">
        <div>
          <h2 className="text-lg font-extrabold">{tutorials.title}</h2>
          {tutorials.subtitle ? (
            <p className="mt-1 text-sm text-muted-foreground">{tutorials.subtitle}</p>
          ) : null}
        </div>
        <TutorialSections data={tutorials} />
      </div>
    </>
  );
}
