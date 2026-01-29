'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getActivities, getWorkouts } from '@/lib/api';

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const { data: activities } = useQuery({
    queryKey: ['activities', 'calendar', format(monthStart, 'yyyy-MM-dd')],
    queryFn: () =>
      getActivities({
        start: format(calendarStart, 'yyyy-MM-dd'),
        end: format(calendarEnd, 'yyyy-MM-dd'),
        limit: 100,
      }),
  });

  const { data: workouts } = useQuery({
    queryKey: ['workouts', 'calendar', format(monthStart, 'yyyy-MM-dd')],
    queryFn: () =>
      getWorkouts({
        start: format(calendarStart, "yyyy-MM-dd'T'00:00:00"),
        end: format(calendarEnd, "yyyy-MM-dd'T'23:59:59"),
      }),
  });

  const getActivitiesForDay = (day: Date) => {
    return activities?.filter((a) => isSameDay(parseISO(a.start_time), day)) || [];
  };

  const getWorkoutsForDay = (day: Date) => {
    return workouts?.filter((w) => isSameDay(parseISO(w.scheduled_date), day)) || [];
  };

  const renderDays = () => {
    const days = [];
    let day = calendarStart;

    while (day <= calendarEnd) {
      const dayActivities = getActivitiesForDay(day);
      const dayWorkouts = getWorkoutsForDay(day);
      const isCurrentMonth = isSameMonth(day, currentMonth);
      const isToday = isSameDay(day, new Date());
      const currentDay = day;

      days.push(
        <div
          key={day.toISOString()}
          className={`min-h-32 border-b border-r border-slate-200 p-2 ${
            isCurrentMonth ? 'bg-white' : 'bg-slate-50'
          }`}
        >
          <div
            className={`text-sm font-medium mb-1 ${
              isToday
                ? 'w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center'
                : isCurrentMonth
                ? 'text-slate-900'
                : 'text-slate-400'
            }`}
          >
            {format(currentDay, 'd')}
          </div>

          <div className="space-y-1">
            {dayWorkouts.map((workout) => (
              <div
                key={workout.id}
                className={`text-xs p-1 rounded truncate ${
                  workout.completed
                    ? 'bg-green-100 text-green-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {workout.name}
              </div>
            ))}

            {dayActivities.map((activity) => (
              <div
                key={activity.id}
                className="text-xs p-1 bg-slate-100 text-slate-700 rounded truncate"
              >
                {activity.name || activity.sport}
                {activity.tss && (
                  <span className="ml-1 text-blue-600 font-medium">
                    {Math.round(activity.tss)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      );

      day = addDays(day, 1);
    }

    return days;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Calendar</h1>
          <p className="text-slate-500 mt-1">Your training schedule</p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-xl font-semibold min-w-40 text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 border-b border-slate-200">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div
              key={day}
              className="py-3 text-center text-sm font-medium text-slate-600 bg-slate-50"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">{renderDays()}</div>
      </div>

      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-100 rounded"></div>
          <span className="text-slate-600">Planned Workout</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-100 rounded"></div>
          <span className="text-slate-600">Completed Workout</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-slate-100 rounded"></div>
          <span className="text-slate-600">Activity</span>
        </div>
      </div>
    </div>
  );
}
