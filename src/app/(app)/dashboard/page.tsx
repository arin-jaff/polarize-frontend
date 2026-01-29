'use client';

import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { getPerformanceSnapshot, getMetricsRange, getActivities } from '@/lib/api';
import { MetricsCard } from '@/components/MetricsCard';
import { PerformanceChart } from '@/components/PerformanceChart';
import { ActivityCard } from '@/components/ActivityCard';

export default function DashboardPage() {
  const today = new Date();
  const thirtyDaysAgo = subDays(today, 30);

  const { data: snapshot, isLoading: loadingSnapshot } = useQuery({
    queryKey: ['performanceSnapshot'],
    queryFn: getPerformanceSnapshot,
  });

  const { data: metricsData, isLoading: loadingMetrics } = useQuery({
    queryKey: ['metrics', format(thirtyDaysAgo, 'yyyy-MM-dd'), format(today, 'yyyy-MM-dd')],
    queryFn: () => getMetricsRange(format(thirtyDaysAgo, 'yyyy-MM-dd'), format(today, 'yyyy-MM-dd')),
  });

  const { data: recentActivities, isLoading: loadingActivities } = useQuery({
    queryKey: ['activities', 'recent'],
    queryFn: () => getActivities({ limit: 5 }),
  });

  const formStatus = (tsb: number) => {
    if (tsb < -30) return { text: 'Very Fatigued', color: 'red' };
    if (tsb < -10) return { text: 'Training Hard', color: 'yellow' };
    if (tsb < 5) return { text: 'Neutral', color: 'blue' };
    if (tsb < 15) return { text: 'Fresh', color: 'green' };
    return { text: 'Very Fresh', color: 'green' };
  };

  const status = snapshot ? formStatus(snapshot.form) : { text: '-', color: 'blue' };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Your training overview</p>
      </div>

      {loadingSnapshot ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-xl"></div>
          ))}
        </div>
      ) : snapshot ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricsCard
            title="Fitness (CTL)"
            value={Math.round(snapshot.fitness)}
            subtitle="42-day chronic load"
            color="blue"
          />
          <MetricsCard
            title="Fatigue (ATL)"
            value={Math.round(snapshot.fatigue)}
            subtitle="7-day acute load"
            color="red"
          />
          <MetricsCard
            title="Form (TSB)"
            value={Math.round(snapshot.form)}
            subtitle={status.text}
            color={status.color as 'blue' | 'green' | 'red' | 'yellow'}
          />
          <MetricsCard
            title="Weekly TSS"
            value={Math.round(snapshot.total_tss_7d)}
            subtitle={`Ramp: ${snapshot.ramp_rate_7d > 0 ? '+' : ''}${snapshot.ramp_rate_7d.toFixed(1)}/wk`}
            color="purple"
          />
        </div>
      ) : null}

      {loadingMetrics ? (
        <div className="h-96 bg-slate-100 animate-pulse rounded-xl"></div>
      ) : metricsData ? (
        <PerformanceChart data={metricsData.daily} />
      ) : null}

      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Recent Activities</h2>
        {loadingActivities ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-lg"></div>
            ))}
          </div>
        ) : recentActivities && recentActivities.length > 0 ? (
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
            <p className="text-slate-500">No activities yet. Upload a FIT file to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
