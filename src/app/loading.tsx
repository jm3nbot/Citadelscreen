export default function Loading() {
  return (
    <div role="status" aria-label="Loading page" className="h-full p-6">
      <div className="h-5 w-40 animate-pulse rounded bg-white/[0.06]" />
      <div className="mt-6 h-32 animate-pulse rounded bg-white/[0.03]" />
    </div>
  );
}
