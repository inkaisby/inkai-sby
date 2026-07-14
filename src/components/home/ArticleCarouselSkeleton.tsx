export default function ArticleCarouselSkeleton() {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10 animate-pulse">
          <div className="mb-4 h-6 w-32 rounded-full bg-muted" />
          <div className="h-9 w-64 rounded-lg bg-muted" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-xl border">
              <div className="h-52 bg-muted" />
              <div className="space-y-3 p-5">
                <div className="h-3 w-24 rounded bg-muted" />
                <div className="h-4 w-full rounded bg-muted" />
                <div className="h-4 w-2/3 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
