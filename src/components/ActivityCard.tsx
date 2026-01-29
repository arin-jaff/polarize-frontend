'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import type { ActivitySummary } from '@/types';

interface ActivityCardProps {
  activity: ActivitySummary;
}

const sportIcons: Record<string, string> = {
  rowing: '🚣',
  cycling: '🚴',
  running: '🏃',
  swimming: '🏊',
  strength: '🏋️',
  walking: '🚶',
  hiking: '🥾',
  other: '💪',
};

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatDistance(meters?: number): string {
  if (!meters) return '-';
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

export function ActivityCard({ activity }: ActivityCardProps) {
  const icon = sportIcons[activity.sport] || sportIcons.other;
  const date = parseISO(activity.start_time);

  return (
    <Link href={`/activities/${activity.id}`}>
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-start gap-4">
          <div className="text-3xl">{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 truncate">
                {activity.name || `${activity.sport} Activity`}
              </h3>
              <span className="text-sm text-slate-500">
                {format(date, 'MMM d, yyyy')}
              </span>
            </div>
            <p className="text-sm text-slate-500 capitalize">{activity.sport}</p>

            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-slate-400">Duration</span>
                <p className="font-medium text-slate-900">
                  {formatDuration(activity.total_timer_time)}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Distance</span>
                <p className="font-medium text-slate-900">
                  {formatDistance(activity.total_distance)}
                </p>
              </div>
              {activity.avg_heart_rate && (
                <div>
                  <span className="text-slate-400">Avg HR</span>
                  <p className="font-medium text-slate-900">{activity.avg_heart_rate} bpm</p>
                </div>
              )}
              {activity.avg_power && (
                <div>
                  <span className="text-slate-400">Avg Power</span>
                  <p className="font-medium text-slate-900">{activity.avg_power} W</p>
                </div>
              )}
              {activity.tss && (
                <div>
                  <span className="text-slate-400">TSS</span>
                  <p className="font-medium text-blue-600">{Math.round(activity.tss)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
