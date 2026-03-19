interface Props {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
}

const COLOR = {
  blue:   'border-blue-500 bg-blue-50',
  green:  'border-green-500 bg-green-50',
  orange: 'border-orange-500 bg-orange-50',
  red:    'border-red-500 bg-red-50',
  purple: 'border-purple-500 bg-purple-50',
};

export default function StatCard({ label, value, sub, color = 'blue' }: Props) {
  return (
    <div className={`rounded-xl border-l-4 p-4 ${COLOR[color]} border border-gray-100 shadow-sm`}>
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
