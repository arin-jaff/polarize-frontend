'use client';

interface MetricsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  color?: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
}

const colorClasses = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
};

export function MetricsCard({ title, value, subtitle, color = 'blue' }: MetricsCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-12 rounded-full ${colorClasses[color]}`} />
        <div>
          <p className="text-sm text-slate-500 uppercase tracking-wide">{title}</p>
          <p className="text-3xl font-bold text-slate-900">{value}</p>
          {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
