'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getActivities } from '@/lib/api';
import { ActivityCard } from '@/components/ActivityCard';

const sportFilters = [
  { value: '', label: 'All Sports' },
  { value: 'rowing', label: 'Rowing' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'running', label: 'Running' },
  { value: 'swimming', label: 'Swimming' },
  { value: 'strength', label: 'Strength' },
];

export default function ActivitiesPage() {
  const [sportFilter, setSportFilter] = useState('');

  const { data: activities, isLoading } = useQuery({
    queryKey: ['activities', sportFilter],
    queryFn: () => getActivities({ sport: sportFilter || undefined, limit: 50 }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Activities</h1>
          <p className="text-slate-500 mt-1">Your workout history</p>
        </div>

        <select
          value={sportFilter}
          onChange={(e) => setSportFilter(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
        >
          {sportFilters.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-lg"></div>
          ))}
        </div>
      ) : activities && activities.length > 0 ? (
        <div className="space-y-4">
          {activities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg border border-slate-200">
          <p className="text-slate-500">No activities found.</p>
        </div>
      )}
    </div>
  );
}
