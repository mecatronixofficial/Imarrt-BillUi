'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { BarChart3, ChartNoAxesCombined } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { DashboardPoint } from '@/lib/dashboard';

type Metric = 'both' | 'sales' | 'purchases';
const compact = (value: number) => new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

function smoothPath(points: number[][]) {
  return points.map(([x, y], index) => {
    if (!index) return `M${x},${y}`;
    const [lastX, lastY] = points[index - 1];
    const middle = (lastX + x) / 2;
    return `C${middle},${lastY} ${middle},${y} ${x},${y}`;
  }).join(' ');
}

export default function DashboardTrend({ points }: { points: DashboardPoint[] }) {
  const [metric, setMetric] = useState<Metric>('both');
  const [mode, setMode] = useState<'area' | 'bar'>('area');
  const [selected, setSelected] = useState<number | null>(null);
  const [width, setWidth] = useState(900);
  const container = useRef<HTMLDivElement>(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(Math.max(260, element.clientWidth)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const series = (['sales', 'purchases'] as const).filter(key => metric === 'both' || metric === key);
  const values = points.flatMap(point => series.map(key => point[key]));
  const minimum = Math.min(0, ...values);
  const maximum = Math.max(1, ...values);
  const upper = maximum * 1.12;
  const lower = minimum < 0 ? minimum * 1.12 : 0;
  const height = width < 500 ? 260 : 300;
  const left = 52, right = width - 15, top = 22, bottom = height - 38;
  const y = (value: number) => bottom - (value - lower) / (upper - lower) * (bottom - top);
  const x = (index: number) => left + (right - left) * (index + 0.5) / Math.max(1, points.length);
  const latest = Math.max(0, points.findLastIndex(point => point.sales !== 0 || point.purchases !== 0));
  const activeIndex = Math.min(selected ?? latest, points.length - 1);
  const active = points[activeIndex];
  const empty = !points.some(point => point.sales !== 0 || point.purchases !== 0);
  const tickStep = Math.max(1, Math.ceil(points.length / (width < 500 ? 4 : 7)));
  const barWidth = Math.min(28, Math.max(3, (right - left) / Math.max(1, points.length) * 0.3));

  return (
    <section className="brand-panel brand-trend" aria-label="Sales and purchase analytics">
      <div className="brand-panel-heading">
        <div><p className="brand-eyebrow">PERFORMANCE</p><h2>Sales & purchase trends</h2></div>
        <div className="brand-chart-mode" aria-label="Chart type">
          <button type="button" aria-label="Area chart" aria-pressed={mode === 'area'} onClick={() => setMode('area')}><ChartNoAxesCombined size={17} /></button>
          <button type="button" aria-label="Bar chart" aria-pressed={mode === 'bar'} onClick={() => setMode('bar')}><BarChart3 size={17} /></button>
        </div>
      </div>
      <div className="brand-trend-controls">
        <div className="brand-segments" aria-label="Chart metric">
          {([['both', 'Overview'], ['sales', 'Sales'], ['purchases', 'Purchases']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={metric === value} onClick={() => setMetric(value)}>{label}</button>)}
        </div>
        <div className="brand-chart-legend"><span><i className="brand-dot sales" /> Net sales</span><span><i className="brand-dot purchases" /> Net purchases</span></div>
      </div>
      <div className="brand-chart-readout" aria-live="polite">
        <span>{active ? `${active.from}${active.to !== active.from ? ' — ' + active.to : ''}` : 'No dates selected'}</span>
        {active && <strong>{series.map(key => `${key === 'sales' ? 'Sales' : 'Purchases'} ${formatCurrency(active[key])}`).join(' · ')}</strong>}
      </div>
      <div ref={container} className="brand-chart-canvas">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${mode === 'area' ? 'Area' : 'Bar'} chart of net sales and purchases. Use the controls or date points to explore.`}>
          <defs>{series.map(key => <linearGradient id={`${id}-${key}`} key={key} x1="0" y1="0" x2="0" y2="1"><stop stopColor={key === 'sales' ? '#f5b700' : '#2348c8'} stopOpacity=".32" /><stop offset="1" stopColor={key === 'sales' ? '#f5b700' : '#2348c8'} stopOpacity=".015" /></linearGradient>)}</defs>
          {Array.from({ length: 5 }, (_, index) => {
            const value = lower + (upper - lower) * index / 4;
            return <g key={index}><line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="#e8eaee" strokeDasharray="3 5" /><text x={left - 10} y={y(value) + 4} textAnchor="end" fill="#85877f" fontSize="10">{compact(value)}</text></g>;
          })}
          <line x1={left} x2={right} y1={y(0)} y2={y(0)} stroke="#d8dbe2" />
          {mode === 'area' ? series.map(key => {
            const coordinates = points.map((point, index) => [x(index), y(point[key])]);
            const line = smoothPath(coordinates);
            return <g key={key}>{coordinates.length > 1 && <path d={`${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${id}-${key})`} />}<path d={line} fill="none" stroke={key === 'sales' ? '#c99500' : '#2348c8'} strokeWidth="2.5" strokeLinecap="round" />{active && <circle cx={x(activeIndex)} cy={y(active[key])} r="4.5" fill={key === 'sales' ? '#f5b700' : '#2348c8'} stroke="white" strokeWidth="2" />}</g>;
          }) : points.map((point, index) => <g key={point.key}>{series.map((key, seriesIndex) => <rect key={key} x={x(index) + (series.length > 1 ? (seriesIndex - 1) * (barWidth + 3) : -barWidth / 2)} y={Math.min(y(point[key]), y(0))} width={barWidth} height={Math.max(point[key] === 0 ? 0 : 2, Math.abs(y(point[key]) - y(0)))} rx="3" fill={key === 'sales' ? '#e0a800' : '#2348c8'} opacity={activeIndex === index ? 1 : 0.75} />)}</g>)}
          {active && <line x1={x(activeIndex)} x2={x(activeIndex)} y1={top} y2={bottom} stroke="#aab0bb" strokeDasharray="4 4" pointerEvents="none" />}
          {points.map((point, index) => <g key={point.key}>
            {(index % tickStep === 0 || index === points.length - 1) && <text x={x(index)} y={height - 12} textAnchor="middle" fontSize="10" fill="#85877f">{point.label}</text>}
            <rect className="brand-chart-target" x={left + index * (right - left) / points.length} y={top} width={(right - left) / points.length} height={bottom - top} fill="transparent" tabIndex={0} role="button" aria-label={`${point.from} to ${point.to}: sales ${formatCurrency(point.sales)}, purchases ${formatCurrency(point.purchases)}`} onMouseEnter={() => setSelected(index)} onFocus={() => setSelected(index)} onClick={() => setSelected(index)} onKeyDown={event => {
              if (event.key === 'ArrowRight') { event.preventDefault(); setSelected(Math.min(points.length - 1, index + 1)); (event.currentTarget.parentElement?.nextElementSibling?.querySelector('[role=button]') as SVGElement | null)?.focus(); }
              if (event.key === 'ArrowLeft') { event.preventDefault(); setSelected(Math.max(0, index - 1)); (event.currentTarget.parentElement?.previousElementSibling?.querySelector('[role=button]') as SVGElement | null)?.focus(); }
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(index); }
            }} />
          </g>)}
        </svg>
        {empty && <div className="brand-chart-empty"><ChartNoAxesCombined size={24} /><strong>No activity in this period</strong><span>Your issued sales and purchase bills will appear here.</span></div>}
      </div>
      <details className="brand-chart-data"><summary>View chart data</summary><div className="brand-data-scroll"><table><caption className="sr-only">Net sales and purchases after returns, grouped by date</caption><thead><tr><th>Period</th><th>Net sales</th><th>Net purchases</th><th>Invoices</th></tr></thead><tbody>{points.map(point => <tr key={point.key}><th>{point.from} — {point.to}</th><td>{formatCurrency(point.sales)}</td><td>{formatCurrency(point.purchases)}</td><td>{point.invoiceCount}</td></tr>)}</tbody></table></div></details>
    </section>
  );
}
