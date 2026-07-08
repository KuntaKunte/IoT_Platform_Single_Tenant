import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';

export default function GaugeWidget({ data }) {
  if (!data || data.value == null) {
    return <p>No data yet</p>;
  }

  const { value, min = 0, max = 100 } = data;
  const percent = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div className="gauge-widget">
      <RadialBarChart
        width={200}
        height={200}
        cx="50%"
        cy="50%"
        innerRadius="70%"
        outerRadius="100%"
        barSize={16}
        data={[{ name: 'value', value: percent, fill: '#2563eb' }]}
        startAngle={90}
        endAngle={-270}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar background dataKey="value" cornerRadius={8} />
      </RadialBarChart>
      <div className="gauge-label">{value}</div>
    </div>
  );
}
