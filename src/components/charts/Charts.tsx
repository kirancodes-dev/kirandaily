import type { ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../common/Card';

const AXIS = { fill: 'currentColor', fontSize: 12 };
const TOOLTIP_STYLE = { borderRadius: 12, border: '1px solid #cbd5e1', color: '#0f172a' };

interface ChartCardProps {
  title: string;
  /** Text summary for screen readers (charts are images to them). */
  summary: string;
  children: ReactNode;
  empty?: boolean;
  height?: number;
}

export function ChartCard({ title, summary, children, empty, height = 220 }: ChartCardProps) {
  return (
    <Card title={title}>
      <p className="sr-only">{summary}</p>
      {empty ? (
        <p className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400" style={{ height }}>
          No data yet — it will appear as you track.
        </p>
      ) : (
        <div className="text-slate-600 dark:text-slate-400" style={{ height }} aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

type Row = Record<string, string | number | boolean | null>;

export function SimpleBarChart({
  data,
  xKey,
  bars,
  unit,
  domainMax,
}: {
  data: Row[];
  xKey: string;
  bars: { key: string; name: string; color: string }[];
  unit?: string;
  domainMax?: number;
}) {
  return (
    <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} vertical={false} />
      <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
      <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} domain={domainMax ? [0, domainMax] : undefined} unit={unit} />
      <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'currentColor', fillOpacity: 0.08 }} />
      {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
      {bars.map((b) => (
        <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[6, 6, 0, 0]} maxBarSize={36} />
      ))}
    </BarChart>
  );
}

export function SimpleLineChart({ data, xKey, yKey, name, color }: { data: Row[]; xKey: string; yKey: string; name: string; color: string }) {
  return (
    <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} vertical={false} />
      <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} />
      <YAxis tick={AXIS} tickLine={false} axisLine={false} domain={[0, 100]} unit="%" />
      <Tooltip contentStyle={TOOLTIP_STYLE} />
      <Line type="monotone" dataKey={yKey} name={name} stroke={color} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
    </LineChart>
  );
}

export function DonutChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <PieChart>
      <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} isAnimationActive={false}>
        {data.map((d) => (
          <Cell key={d.name} fill={d.color} />
        ))}
      </Pie>
      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${v} h`} />
      <Legend wrapperStyle={{ fontSize: 12 }} />
    </PieChart>
  );
}
