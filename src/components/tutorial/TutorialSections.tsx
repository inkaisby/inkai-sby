import { youtubeEmbedSrc, type MemberTutorialsJson } from "@/lib/memberTutorials";

export function TutorialSections({
  data,
  className,
}: {
  data: MemberTutorialsJson;
  className?: string;
}) {
  return (
    <div className={className ?? "space-y-4"}>
      {data.sections.map((section) => {
        const embed = youtubeEmbedSrc(section.youtubeUrl);
        return (
          <section
            key={section.id}
            id={section.id}
            className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5"
          >
            <h3 className="text-base font-extrabold sm:text-lg">{section.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{section.summary}</p>

            <div className="mt-4 overflow-hidden rounded-xl bg-muted/40">
              {embed ? (
                <div className="relative aspect-video w-full">
                  <iframe
                    src={embed}
                    title={`Video: ${section.title}`}
                    className="absolute inset-0 h-full w-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
              ) : (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Video segera tersedia
                </p>
              )}
            </div>

            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-foreground/90">
              {section.steps.map((step) => (
                <li key={step} className="leading-relaxed pl-1">
                  {step}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
