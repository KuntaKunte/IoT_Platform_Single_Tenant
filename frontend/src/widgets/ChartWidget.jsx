import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ChartWidget({ data }) {
  if (!data || data.length === 0) {
    return <p>No data yet</p>;
  }

  const points = data.map((item) => ({
    time: new Date(item.receivedAt).toLocaleTimeString(),
    value: item.value
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={points}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="value" stroke="#2563eb" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
