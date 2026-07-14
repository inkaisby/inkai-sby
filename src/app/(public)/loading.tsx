export default function PublicLoading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-4 h-6 w-24 rounded-full bg-muted" />
      <div className="mb-8 h-10 w-2/3 max-w-md rounded-lg bg-muted" />
      <div className="space-y-3">
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-5/6 rounded bg-muted" />
        <div className="h-4 w-4/6 rounded bg-muted" />
      </div>
    </div>
  );
}
