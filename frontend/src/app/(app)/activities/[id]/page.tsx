'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { getActivity, getActivityRecords, deleteActivity } from '@/lib/api';
import { PerformanceChart } from '@/components/PerformanceChart';

export default function ActivityDetailPage() {
  const params = useParams();
  const router = useRouter();
  const activityId = params.id as string;
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ['activity', activityId],
    queryFn: () => getActivity(activityId),
  });

  const { data: recordsData } = useQuery({
    queryKey: ['activity-records', activityId],
    queryFn: () => getActivityRecords(activityId),
    enabled: !!activity,
  });

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this activity? This cannot be undone.')) {
      return;
    }

    if (isDeleting) return; // Prevent multiple clicks

    setIsDeleting(true);
    try {
      await deleteActivity(activityId);
      // Wait a moment before redirecting to ensure the delete completed
      setTimeout(() => {
        router.push('/activities');
      }, 100);
    } catch (error) {
      alert('Failed to delete activity. Please try again.');
      setIsDeleting(false);
    }
  };

  if (activityLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-slate-100 animate-pulse rounded"></div>
        <div className="h-64 bg-slate-100 animate-pulse rounded-lg"></div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 mb-4">Activity not found</p>
        <Link href="/activities" className="text-blue-600 hover:underline">
          Back to activities
        </Link>
      </div>
    );
  }

  const sportEmojis: Record<string, string> = {
    rowing: '🚣',
    cycling: '🚴',
    running: '🏃',
    swimming: '🏊',
    strength: '🏋️',
    walking: '🚶',
    hiking: '🥾',
    other: '💪',
  };

  const emoji = sportEmojis[activity.sport] || sportEmojis.other;
  const date = new Date(activity.start_time);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/activities" className="text-blue-600 hover:underline text-sm mb-4 inline-block">
          ← Back to activities
        </Link>
        <div className="flex items-center justify-between gap-3 mt-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{emoji}</span>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{activity.name || activity.sport}</h1>
              <p className="text-slate-500">{date.toLocaleString()}</p>
            </div>
          </div>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      {activity.description && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-slate-700">{activity.description}</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Duration</p>
          <p className="text-2xl font-bold text-slate-900">
            {activity.duration_seconds
              ? `${Math.floor(activity.duration_seconds / 3600)}:${Math.floor((activity.duration_seconds % 3600) / 60)
                  .toString()
                  .padStart(2, '0')}`
              : '-'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Distance</p>
          <p className="text-2xl font-bold text-slate-900">
            {activity.total_distance ? `${(activity.total_distance / 1000).toFixed(2)} km` : '-'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Avg HR</p>
          <p className="text-2xl font-bold text-slate-900">{activity.avg_heart_rate ?? 0} bpm</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Avg Power</p>
          <p className="text-2xl font-bold text-slate-900">{activity.avg_power ?? 0} W</p>
        </div>
      </div>

      {recordsData?.records && recordsData.records.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Performance Data</h2>
          <PerformanceChart records={recordsData.records} />
        </div>
      )}
    </div>
  );
}
