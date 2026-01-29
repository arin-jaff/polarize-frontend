'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import type { DailyMetrics, RecordPoint } from '@/types';
import { format, parseISO } from 'date-fns';

interface PerformanceChartProps {
  data?: DailyMetrics[] | RecordPoint[];
  records?: RecordPoint[];
}

export function PerformanceChart({ data, records }: PerformanceChartProps) {
  const dataToUse = records || data;
  
  if (!dataToUse || dataToUse.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Performance Metrics</h3>
        <p className="text-slate-500 text-center py-8">No data available</p>
      </div>
    );
  }

  // Check if data is DailyMetrics or RecordPoint
  const isDailyMetrics = 'date' in dataToUse[0];
  
  const chartData = dataToUse.map((d: any) => {
    if (isDailyMetrics) {
      return {
        ...d,
        date: format(parseISO(d.date), 'MMM d'),
      };
    } else {
      // RecordPoint - use timestamp with time
      return {
        ...d,
        date: format(parseISO(d.timestamp), 'HH:mm:ss'),
      };
    }
  });

  if (isDailyMetrics) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Performance Metrics</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="ctl"
                name="Fitness (CTL)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="atl"
                name="Fatigue (ATL)"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="tsb"
                name="Form (TSB)"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  // Record points - show multiple charts
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Heart Rate</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                label={{ value: 'BPM', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
                formatter={(value) => (value ? `${value} bpm` : '-')}
              />
              <Line
                type="monotone"
                dataKey="heart_rate"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                name="Heart Rate"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Power Output</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                label={{ value: 'Watts', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
                formatter={(value) => (value ? `${value} W` : '-')}
              />
              <Line
                type="monotone"
                dataKey="power"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                name="Power"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Pace & Cadence</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                label={{ value: 'Speed (m/s)', angle: -90, position: 'insideLeft' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
                label={{ value: 'Cadence (rpm)', angle: 90, position: 'insideRight' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="speed"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Speed (m/s)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cadence"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                name="Cadence (rpm)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
