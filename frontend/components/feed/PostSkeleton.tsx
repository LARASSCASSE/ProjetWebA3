export default function PostSkeleton() {
  return (
    <div className="animate-pulse border-b border-gray-200 p-4">
      <div className="flex gap-3">
        <div className="h-9 w-9 flex-none rounded-full bg-gray-200" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-3 w-1/3 rounded bg-gray-200" />
          <div className="h-3 w-full rounded bg-gray-200" />
          <div className="h-3 w-2/3 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
}
