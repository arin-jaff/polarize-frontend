'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Check,
  X,
  RefreshCw,
  Calendar,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
  Download,
  AlertTriangle,
} from 'lucide-react';
import {
  getCoachingContext,
  analyzePlan,
  generateWeeklyPlan,
  applyPlanModifications,
  refinePlanSuggestions,
  getWorkoutFitUrl,
} from '@/lib/api';
import type {
  CoachingContext,
  PlanModificationResponse,
  ModificationPreview,
} from '@/types';

type Mode = 'analyze' | 'generate';

export default function PlanModifier() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>('analyze');
  const [feedback, setFeedback] = useState('');
  const [goals, setGoals] = useState('');
  const [constraints, setConstraints] = useState('');
  const [suggestions, setSuggestions] = useState<PlanModificationResponse | null>(null);
  const [refinementInput, setRefinementInput] = useState('');
  const [expandedMods, setExpandedMods] = useState<Set<number>>(new Set());

  // Fetch context
  const { data: context, isLoading: contextLoading } = useQuery({
    queryKey: ['coachingContext'],
    queryFn: getCoachingContext,
  });

  // Analyze mutation
  const analyzeMutation = useMutation({
    mutationFn: () => analyzePlan(feedback),
    onSuccess: (data) => {
      setSuggestions(data);
      setRefinementInput('');
    },
  });

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: () => generateWeeklyPlan(goals, constraints || undefined),
    onSuccess: (data) => {
      setSuggestions(data);
      setRefinementInput('');
    },
  });

  // Refine mutation
  const refineMutation = useMutation({
    mutationFn: () => {
      if (!suggestions) throw new Error('No suggestions to refine');
      return refinePlanSuggestions(suggestions.raw_response, refinementInput);
    },
    onSuccess: (data) => {
      setSuggestions(data);
      setRefinementInput('');
    },
  });

  // Apply mutation
  const applyMutation = useMutation({
    mutationFn: () => {
      if (!suggestions) throw new Error('No suggestions to apply');
      return applyPlanModifications(suggestions.raw_response, false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] });
      queryClient.invalidateQueries({ queryKey: ['coachingContext'] });
      setSuggestions(null);
      setFeedback('');
      setGoals('');
    },
  });

  const isLoading =
    analyzeMutation.isPending ||
    generateMutation.isPending ||
    refineMutation.isPending ||
    applyMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'analyze') {
      analyzeMutation.mutate();
    } else {
      generateMutation.mutate();
    }
  };

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedMods);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedMods(newExpanded);
  };

  const getFormStatusColor = (status: string) => {
    switch (status) {
      case 'very_fatigued':
        return 'text-red-600 bg-red-50';
      case 'fatigued':
        return 'text-orange-600 bg-orange-50';
      case 'slightly_fatigued':
        return 'text-yellow-600 bg-yellow-50';
      case 'fresh':
        return 'text-green-600 bg-green-50';
      case 'very_fresh':
        return 'text-emerald-600 bg-emerald-50';
      default:
        return 'text-slate-600 bg-slate-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Context Display */}
      {context && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Current Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {Math.round(context.athlete.fitness_ctl)}
              </div>
              <div className="text-sm text-slate-600">Fitness (CTL)</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {Math.round(context.athlete.fatigue_atl)}
              </div>
              <div className="text-sm text-slate-600">Fatigue (ATL)</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {Math.round(context.athlete.form_tsb)}
              </div>
              <div className="text-sm text-slate-600">Form (TSB)</div>
            </div>
            <div
              className={`text-center p-3 rounded-lg ${getFormStatusColor(
                context.athlete.form_status
              )}`}
            >
              <div className="text-lg font-semibold capitalize">
                {context.athlete.form_status.replace('_', ' ')}
              </div>
              <div className="text-xs mt-1">{context.athlete.form_description}</div>
            </div>
          </div>

          {/* Upcoming workouts preview */}
          {context.upcoming_workouts.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-slate-700 mb-2">
                Upcoming Workouts ({context.upcoming_workouts.length})
              </h4>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {context.upcoming_workouts.slice(0, 5).map((w) => (
                  <div
                    key={w.id}
                    className="flex-shrink-0 px-3 py-2 bg-slate-50 rounded-lg text-sm"
                  >
                    <div className="font-medium">{w.name}</div>
                    <div className="text-slate-500 text-xs">
                      {w.date} • {w.sport}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode Toggle & Input */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('analyze')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              mode === 'analyze'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Analyze & Modify
          </button>
          <button
            onClick={() => setMode('generate')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              mode === 'generate'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Generate Week
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'analyze' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                How are you feeling? Any concerns?
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="E.g., Feeling tired after yesterday's hard session (RPE 9), slight knee soreness..."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                rows={3}
                disabled={isLoading}
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Training Goals
                </label>
                <textarea
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  placeholder="E.g., Build aerobic base, prepare for 2K erg test..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  rows={2}
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Constraints (optional)
                </label>
                <textarea
                  value={constraints}
                  onChange={(e) => setConstraints(e.target.value)}
                  placeholder="E.g., Can only train mornings, max 8 hours total..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  rows={2}
                  disabled={isLoading}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={
              isLoading || (mode === 'analyze' ? !feedback.trim() : !goals.trim())
            }
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <Sparkles size={18} />
            )}
            {isLoading
              ? 'Generating with AI (this may take 30-60s)...'
              : mode === 'analyze'
              ? 'Analyze Plan'
              : 'Generate Plan'}
          </button>
        </form>
      </div>

      {/* Suggestions Display */}
      {suggestions && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">AI Suggestions</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setSuggestions(null)}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                title="Dismiss"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Errors */}
          {suggestions.errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 font-medium">
                <AlertTriangle size={18} />
                Errors
              </div>
              <ul className="mt-2 text-sm text-red-600 list-disc list-inside">
                {suggestions.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Athlete Message */}
          {suggestions.athlete_message && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-slate-700">{suggestions.athlete_message}</p>
            </div>
          )}

          {/* Load Adjustment */}
          {suggestions.load_adjustment && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                <Zap size={18} />
                Weekly Load Adjustment
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-slate-600">
                  Current: {suggestions.load_adjustment.current_weekly_tss} TSS
                </span>
                <span className="text-lg">→</span>
                <span className="font-medium text-amber-700">
                  Recommended: {suggestions.load_adjustment.recommended_weekly_tss} TSS
                </span>
              </div>
              {suggestions.load_adjustment.reason && (
                <p className="mt-2 text-sm text-slate-600">
                  {suggestions.load_adjustment.reason}
                </p>
              )}
            </div>
          )}

          {/* Modifications */}
          <div className="space-y-3">
            {suggestions.modifications.map((mod, i) => (
              <ModificationCard
                key={i}
                modification={mod}
                expanded={expandedMods.has(i)}
                onToggle={() => toggleExpanded(i)}
              />
            ))}
          </div>

          {/* Refinement Input */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Want to adjust these suggestions?
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={refinementInput}
                onChange={(e) => setRefinementInput(e.target.value)}
                placeholder="E.g., Keep Thursday but make it easier..."
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                disabled={isLoading}
              />
              <button
                onClick={() => refineMutation.mutate()}
                disabled={isLoading || !refinementInput.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw size={16} />
                Refine
              </button>
            </div>
          </div>

          {/* Apply Button */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={() => setSuggestions(null)}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => applyMutation.mutate()}
              disabled={isLoading || !suggestions.success}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <Check size={18} />
              Apply Changes
            </button>
          </div>

          {/* Apply Result */}
          {applyMutation.isSuccess && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700">
              Changes applied successfully!
              {applyMutation.data.created_workouts.length > 0 && (
                <span>
                  {' '}
                  Created {applyMutation.data.created_workouts.length} workout(s).
                </span>
              )}
              {applyMutation.data.modified_workouts.length > 0 && (
                <span>
                  {' '}
                  Modified {applyMutation.data.modified_workouts.length} workout(s).
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModificationCard({
  modification,
  expanded,
  onToggle,
}: {
  modification: ModificationPreview;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isNewWorkout = modification.type === 'new_workout';
  const isSkip = modification.action === 'skip';

  const getActionColor = () => {
    if (isNewWorkout) return 'bg-green-100 text-green-700 border-green-200';
    if (isSkip) return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-blue-100 text-blue-700 border-blue-200';
  };

  const getActionLabel = () => {
    if (isNewWorkout) return 'New';
    if (isSkip) return 'Skip';
    return 'Modify';
  };

  return (
    <div className={`border rounded-lg ${isSkip ? 'opacity-60' : ''}`}>
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50"
      >
        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-1 text-xs font-medium rounded border ${getActionColor()}`}
          >
            {getActionLabel()}
          </span>
          <div>
            <div className="font-medium">
              {modification.new_name || modification.original_name}
            </div>
            <div className="text-sm text-slate-500 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {modification.date}
              </span>
              {modification.sport && (
                <span className="capitalize">{modification.sport}</span>
              )}
              {modification.duration_minutes && (
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {modification.duration_minutes} min
                </span>
              )}
              {modification.estimated_tss && (
                <span className="flex items-center gap-1">
                  <Zap size={14} />
                  {modification.estimated_tss} TSS
                </span>
              )}
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100">
          {modification.notes && (
            <p className="mt-3 text-sm text-slate-600">{modification.notes}</p>
          )}

          {modification.details && Object.keys(modification.details).length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-sm font-medium text-slate-700">Changes:</div>
              {Object.entries(modification.details).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500 capitalize">{key}:</span>
                  {value.from && (
                    <>
                      <span className="line-through text-slate-400">{value.from}</span>
                      <span>→</span>
                    </>
                  )}
                  <span className="font-medium">{value.to}</span>
                </div>
              ))}
            </div>
          )}

          {modification.workout_id && (
            <div className="mt-3">
              <a
                href={getWorkoutFitUrl(modification.workout_id)}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                <Download size={14} />
                Download FIT file
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
