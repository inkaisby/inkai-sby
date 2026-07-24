export default function PublicLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24" aria-busy="true">
      <div className="mx-auto mb-10 h-3 w-24 animate-pulse rounded-full bg-muted" />
      <div className="mx-auto mb-4 h-9 max-w-md animate-pulse rounded-lg bg-muted" />
      <div className="mx-auto mb-12 h-4 max-w-lg animate-pulse rounded bg-muted/70" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-2xl border border-border/60 bg-muted/40"
          />
        ))}
      </div>
      <span className="sr-only">Memuat halaman…</span>
    </div>
  );
}
