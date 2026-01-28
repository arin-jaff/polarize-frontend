'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getHrMethods,
  getPowerMethods,
  getHrZones,
  getPowerZones,
  updateThresholds,
  updateZoneConfig,
  getCoachSettings,
  updateCoachSettings,
} from '@/lib/api';
import type { CoachSettings } from '@/types';
import { useAuth } from '@/lib/auth-context';

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'thresholds' | 'zones' | 'scaling' | 'coach' | 'integrations'>(
    'thresholds'
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Configure your training preferences</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: 'thresholds', label: 'Thresholds' },
          { id: 'zones', label: 'Zones' },
          { id: 'scaling', label: 'Sport Scaling' },
          { id: 'coach', label: 'AI Coach' },
          { id: 'integrations', label: 'Integrations' },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as typeof activeTab)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === id
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        {activeTab === 'thresholds' && <ThresholdsTab />}
        {activeTab === 'zones' && <ZonesTab />}
        {activeTab === 'scaling' && <ScalingTab primarySport={user?.primary_sport || 'rowing'} />}
        {activeTab === 'coach' && <CoachTab />}
        {activeTab === 'integrations' && <IntegrationsTab />}
      </div>
    </div>
  );
}

function ThresholdsTab() {
  const queryClient = useQueryClient();
  const [thresholds, setThresholds] = useState({
    threshold_hr: '',
    max_hr: '',
    resting_hr: '',
    threshold_power: '',
    running_threshold_power: '',
    critical_power: '',
  });

  const mutation = useMutation({
    mutationFn: (data: Record<string, number>) => updateThresholds(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrZones'] });
      queryClient.invalidateQueries({ queryKey: ['powerZones'] });
    },
  });

  const handleSave = () => {
    const data: Record<string, number> = {};
    Object.entries(thresholds).forEach(([key, value]) => {
      if (value) data[key] = parseInt(value);
    });
    mutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Threshold Values</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium text-slate-700 mb-3">Heart Rate</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Lactate Threshold HR (LTHR)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={thresholds.threshold_hr}
                  onChange={(e) =>
                    setThresholds({ ...thresholds, threshold_hr: e.target.value })
                  }
                  placeholder="180"
                  className="w-24 px-3 py-2 border border-slate-300 rounded-lg"
                />
                <span className="text-slate-500">bpm</span>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Max Heart Rate</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={thresholds.max_hr}
                  onChange={(e) => setThresholds({ ...thresholds, max_hr: e.target.value })}
                  placeholder="200"
                  className="w-24 px-3 py-2 border border-slate-300 rounded-lg"
                />
                <span className="text-slate-500">bpm</span>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">Resting Heart Rate</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={thresholds.resting_hr}
                  onChange={(e) =>
                    setThresholds({ ...thresholds, resting_hr: e.target.value })
                  }
                  placeholder="50"
                  className="w-24 px-3 py-2 border border-slate-300 rounded-lg"
                />
                <span className="text-slate-500">bpm</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-medium text-slate-700 mb-3">Power</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Functional Threshold Power (FTP)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={thresholds.threshold_power}
                  onChange={(e) =>
                    setThresholds({ ...thresholds, threshold_power: e.target.value })
                  }
                  placeholder="250"
                  className="w-24 px-3 py-2 border border-slate-300 rounded-lg"
                />
                <span className="text-slate-500">W</span>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Running Threshold Power (rFTP)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={thresholds.running_threshold_power}
                  onChange={(e) =>
                    setThresholds({
                      ...thresholds,
                      running_threshold_power: e.target.value,
                    })
                  }
                  placeholder="280"
                  className="w-24 px-3 py-2 border border-slate-300 rounded-lg"
                />
                <span className="text-slate-500">W</span>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Critical Power (CP) - Stryd
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={thresholds.critical_power}
                  onChange={(e) =>
                    setThresholds({ ...thresholds, critical_power: e.target.value })
                  }
                  placeholder="260"
                  className="w-24 px-3 py-2 border border-slate-300 rounded-lg"
                />
                <span className="text-slate-500">W</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={mutation.isPending}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
      >
        {mutation.isPending ? 'Saving...' : 'Save Thresholds'}
      </button>
    </div>
  );
}

function ZonesTab() {
  const { data: hrMethods } = useQuery({
    queryKey: ['hrMethods'],
    queryFn: getHrMethods,
  });
  const { data: powerMethods } = useQuery({
    queryKey: ['powerMethods'],
    queryFn: getPowerMethods,
  });
  const { data: hrZones } = useQuery({
    queryKey: ['hrZones'],
    queryFn: getHrZones,
  });
  const { data: powerZones } = useQuery({
    queryKey: ['powerZones'],
    queryFn: getPowerZones,
  });

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Heart Rate Zones</h3>
        {hrMethods && (
          <div className="mb-4">
            <label className="block text-sm text-slate-600 mb-1">Calculation Method</label>
            <select className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
              {hrMethods.map((m) => (
                <option key={m.method_id} value={m.method_id}>
                  {m.name} ({m.zone_count} zones)
                </option>
              ))}
            </select>
          </div>
        )}
        {hrZones && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">Zone</th>
                  <th className="text-left py-2 pr-4">Name</th>
                  <th className="text-left py-2">Range</th>
                </tr>
              </thead>
              <tbody>
                {hrZones.zones.map((zone) => (
                  <tr key={zone.zone_number} className="border-b">
                    <td className="py-2 pr-4 font-medium">{zone.zone_number}</td>
                    <td className="py-2 pr-4">{zone.name}</td>
                    <td className="py-2">
                      {zone.lower} - {zone.upper} bpm
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Power Zones</h3>
        {powerMethods && (
          <div className="mb-4">
            <label className="block text-sm text-slate-600 mb-1">Calculation Method</label>
            <select className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
              {powerMethods.map((m) => (
                <option key={m.method_id} value={m.method_id}>
                  {m.name} ({m.zone_count} zones)
                </option>
              ))}
            </select>
          </div>
        )}
        {powerZones && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4">Zone</th>
                  <th className="text-left py-2 pr-4">Name</th>
                  <th className="text-left py-2">Range</th>
                </tr>
              </thead>
              <tbody>
                {powerZones.zones.map((zone) => (
                  <tr key={zone.zone_number} className="border-b">
                    <td className="py-2 pr-4 font-medium">{zone.zone_number}</td>
                    <td className="py-2 pr-4">{zone.name}</td>
                    <td className="py-2">
                      {zone.lower} - {zone.upper} W
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ScalingTab({ primarySport }: { primarySport: string }) {
  const [scaling, setScaling] = useState<Record<string, string>>({
    rowing: '1.0',
    cycling: '0.8',
    running: '1.0',
    swimming: '0.7',
    strength: '0.5',
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Sport-Specific TSS Scaling</h3>
        <p className="text-slate-500 text-sm mt-1">
          Adjust how TSS from different sports contributes to your overall training load
          relative to your primary sport ({primarySport}).
        </p>
      </div>

      <div className="space-y-4">
        {Object.entries(scaling).map(([sport, value]) => (
          <div key={sport} className="flex items-center gap-4">
            <span className="w-24 capitalize text-slate-700">{sport}</span>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.1"
              value={value}
              onChange={(e) => setScaling({ ...scaling, [sport]: e.target.value })}
              className="flex-1"
            />
            <span className="w-16 text-right text-slate-600">
              {parseFloat(value).toFixed(1)}x
            </span>
          </div>
        ))}
      </div>

      <p className="text-sm text-slate-500">
        Example: If cycling is set to 0.8x and you do a 100 TSS bike ride, it will
        contribute 80 TSS to your overall fitness/fatigue metrics.
      </p>

      <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
        Save Scaling Factors
      </button>
    </div>
  );
}

function IntegrationsTab() {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Connected Services</h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-2xl">
              ⌚
            </div>
            <div>
              <h4 className="font-medium">Garmin Connect</h4>
              <p className="text-sm text-slate-500">
                Sync activities and health metrics from Garmin
              </p>
            </div>
          </div>
          <button className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">
            Connect
          </button>
        </div>

        <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-2xl">
              🚣
            </div>
            <div>
              <h4 className="font-medium">Concept2 Logbook</h4>
              <p className="text-sm text-slate-500">
                Sync rowing workouts from Concept2
              </p>
            </div>
          </div>
          <button className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">
            Connect
          </button>
        </div>
      </div>
    </div>
  );
}

function CoachTab() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<CoachSettings>({
    coach_type: 'specialist',
    training_plan: 'polarized',
    time_constraint: 'moderate',
  });

  const { data: savedSettings, isLoading } = useQuery({
    queryKey: ['coachSettings'],
    queryFn: getCoachSettings,
  });

  // Update local state when data loads
  useState(() => {
    if (savedSettings) {
      setSettings(savedSettings);
    }
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<CoachSettings>) => updateCoachSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coachSettings'] });
    },
  });

  const handleSave = () => {
    mutation.mutate(settings);
  };

  // Sync local state with fetched data
  if (savedSettings && settings.coach_type !== savedSettings.coach_type) {
    setSettings(savedSettings);
  }

  const coachTypes = [
    {
      id: 'specialist',
      name: 'Specialist',
      description: 'Single-sport focus, maximize performance. Direct coaching style that pushes you to your limits.',
    },
    {
      id: 'generalist',
      name: 'Generalist',
      description: 'Multi-sport balanced approach. Good for triathletes or those who enjoy variety.',
      disabled: true,
    },
    {
      id: 'recreational',
      name: 'Recreational',
      description: 'Fitness-focused with flexible scheduling. Perfect for maintaining health without intense pressure.',
      disabled: true,
    },
  ];

  const trainingPlans = [
    {
      id: 'polarized',
      name: 'Polarized (80/20)',
      description: '80% easy (Zone 1), 20% hard (Zone 3). No threshold work. Science-backed for endurance.',
    },
    {
      id: 'traditional',
      name: 'Traditional (Pyramidal)',
      description: 'More time at threshold, pyramidal distribution. Classic approach.',
      disabled: true,
    },
    {
      id: 'threshold',
      name: 'Sweet Spot',
      description: 'Focus on sweet spot and threshold work. Time-efficient but demanding.',
      disabled: true,
    },
  ];

  const timeConstraints = [
    { id: 'minimal', name: 'Minimal', hours: '0-5 hours/week', tss: '150-250 TSS' },
    { id: 'moderate', name: 'Moderate', hours: '5-10 hours/week', tss: '250-400 TSS' },
    { id: 'committed', name: 'Committed', hours: '10-15 hours/week', tss: '400-550 TSS' },
    { id: 'serious', name: 'Serious', hours: '15-20 hours/week', tss: '550-750 TSS' },
    { id: 'elite', name: 'Elite', hours: '20+ hours/week', tss: '750-1000+ TSS' },
  ];

  if (isLoading) {
    return <div className="text-slate-500">Loading coach settings...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold">AI Coach Personality</h3>
        <p className="text-slate-500 text-sm mt-1">
          Configure how your AI coach approaches training recommendations.
        </p>
      </div>

      {/* Coach Type */}
      <div>
        <h4 className="font-medium text-slate-700 mb-3">Coach Type</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {coachTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => !type.disabled && setSettings({ ...settings, coach_type: type.id as CoachSettings['coach_type'] })}
              disabled={type.disabled}
              className={`p-4 border rounded-lg text-left transition-all ${
                settings.coach_type === type.id
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : type.disabled
                  ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="font-medium text-slate-900">
                {type.name}
                {type.disabled && <span className="text-xs text-slate-400 ml-2">(Coming Soon)</span>}
              </div>
              <div className="text-sm text-slate-500 mt-1">{type.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Training Plan */}
      <div>
        <h4 className="font-medium text-slate-700 mb-3">Training Philosophy</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {trainingPlans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => !plan.disabled && setSettings({ ...settings, training_plan: plan.id as CoachSettings['training_plan'] })}
              disabled={plan.disabled}
              className={`p-4 border rounded-lg text-left transition-all ${
                settings.training_plan === plan.id
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : plan.disabled
                  ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="font-medium text-slate-900">
                {plan.name}
                {plan.disabled && <span className="text-xs text-slate-400 ml-2">(Coming Soon)</span>}
              </div>
              <div className="text-sm text-slate-500 mt-1">{plan.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Time Constraint */}
      <div>
        <h4 className="font-medium text-slate-700 mb-3">Weekly Time Commitment</h4>
        <div className="space-y-2">
          {timeConstraints.map((constraint) => (
            <button
              key={constraint.id}
              onClick={() => setSettings({ ...settings, time_constraint: constraint.id as CoachSettings['time_constraint'] })}
              className={`w-full p-3 border rounded-lg text-left transition-all flex items-center justify-between ${
                settings.time_constraint === constraint.id
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <span className="font-medium text-slate-900">{constraint.name}</span>
                <span className="text-slate-500 ml-2">{constraint.hours}</span>
              </div>
              <span className="text-sm text-slate-400">{constraint.tss}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Specific Hours Override */}
      <div>
        <h4 className="font-medium text-slate-700 mb-3">Specific Weekly Hours (Optional)</h4>
        <p className="text-sm text-slate-500 mb-2">
          Override the time constraint category with a specific number of hours.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={settings.weekly_hours_available || ''}
            onChange={(e) =>
              setSettings({
                ...settings,
                weekly_hours_available: e.target.value ? parseFloat(e.target.value) : undefined,
              })
            }
            placeholder="e.g., 12"
            min="0"
            max="50"
            step="0.5"
            className="w-24 px-3 py-2 border border-slate-300 rounded-lg"
          />
          <span className="text-slate-500">hours/week</span>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-200">
        <button
          onClick={handleSave}
          disabled={mutation.isPending}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving...' : 'Save Coach Settings'}
        </button>
        {mutation.isSuccess && (
          <span className="ml-3 text-green-600 text-sm">Settings saved successfully!</span>
        )}
        {mutation.isError && (
          <span className="ml-3 text-red-600 text-sm">Failed to save settings.</span>
        )}
      </div>
    </div>
  );
}
