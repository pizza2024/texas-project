interface StatCardProps {
  title: string;
  value: string | number;
  icon?: string;
  trend?: { value: number; label: string };
  color?: 'blue' | 'green' | 'yellow' | 'purple' | 'red';
}

const colorMap = {
  blue: 'bg-blue-500/10 text-blue-400',
  green: 'bg-green-500/10 text-green-400',
  yellow: 'bg-yellow-500/10 text-yellow-400',
  purple: 'bg-purple-500/10 text-purple-400',
  red: 'bg-red-500/10 text-red-400',
};

export default function StatCard({ title, value, icon, trend, color = 'blue' }: StatCardProps) {
  return (
    <div className="bg-[#161b27] border border-[#1e2535] rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {trend && (
            <p className={`text-xs mt-1 ${trend.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {trend.value >= 0 ? '▲' : '▼'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        {icon && (
          <div className={`text-2xl rounded-lg p-2 ${colorMap[color]}`}>{icon}</div>
        )}
      </div>
    </div>
  );
}
