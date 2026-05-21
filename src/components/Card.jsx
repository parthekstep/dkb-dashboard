export function Card({ title, value, subtext, borderColor, children }) {
  return (
    <div
      className="bg-[#F8F9FA] rounded-lg p-4 shadow-sm flex flex-col justify-between min-h-[120px]"
      style={borderColor ? { borderLeft: `4px solid ${borderColor}` } : {}}
    >
      <div className="text-sm font-medium text-gray-600">{title}</div>
      {children ?? (
        <div className="text-3xl font-semibold text-[#1F3864] mt-2">{value}</div>
      )}
      {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-[#F8F9FA] rounded-lg p-4 min-h-[120px] animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
      <div className="h-8 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-2/3" />
    </div>
  );
}
