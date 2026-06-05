export default function Loading() {
  return (
    <div className="p-8 animate-pulse">
      <div className="h-8 w-56 bg-slate-200 rounded mb-2" />
      <div className="h-4 w-36 bg-slate-100 rounded mb-8" />
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border p-5 h-24" />
        ))}
      </div>
      <div className="bg-white rounded-xl border h-80" />
    </div>
  );
}
