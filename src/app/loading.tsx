export default function Loading() {
  return (
    <div className="p-8 animate-pulse">
      <div className="h-8 w-48 bg-slate-200 rounded mb-2" />
      <div className="h-4 w-32 bg-slate-100 rounded mb-8" />
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border p-5 h-24" />
        ))}
      </div>
      <div className="bg-white rounded-xl border h-64" />
    </div>
  );
}
