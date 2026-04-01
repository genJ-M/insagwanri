export default function Loading() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="page-container">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse mb-2" />
        <div className="h-4 w-72 bg-gray-100 rounded animate-pulse mb-6" />
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 w-20 bg-white rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="bg-white rounded-xl border border-border p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
