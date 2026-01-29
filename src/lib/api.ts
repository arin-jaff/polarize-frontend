import axios from 'axios';
import type {
  User,
  ActivitySummary,
  ActivityDetail,
  PerformanceSnapshot,
  DailyMetrics,
  WeeklySummary,
  ZoneResult,
  ZoneMethodInfo,
  PlannedWorkout,
  RecordPoint,
  CoachingContext,
  PlanModificationResponse,
  ApplyModificationsResponse,
  CoachSettings,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export async function register(email: string, password: string, name: string, primarySport: string) {
  const { data } = await api.post('/auth/register', {
    email,
    password,
    name,
    primary_sport: primarySport,
  });
  return data;
}

export async function login(email: string, password: string) {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await api.get('/auth/me');
  return data;
}

// Activities
export async function getActivities(params?: {
  start?: string;
  end?: string;
  sport?: string;
  limit?: number;
  offset?: number;
}): Promise<ActivitySummary[]> {
  const { data } = await api.get('/activities', { params });
  return data;
}

export async function getActivity(id: string): Promise<ActivityDetail> {
  const { data } = await api.get(`/activities/${id}`);
  return data;
}

export async function getActivityRecords(id: string): Promise<{ records: RecordPoint[] }> {
  const { data } = await api.get(`/activities/${id}/records`);
  return data;
}

export async function uploadFitFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/activities/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function deleteActivity(id: string) {
  await api.delete(`/activities/${id}`);
}

export async function combineActivities(
  activityId1: string,
  activityId2: string,
  timeOffsetMs: number = 0,
  preferDataFrom: number = 1
) {
  const { data } = await api.post('/activities/combine', {
    activity_id_1: activityId1,
    activity_id_2: activityId2,
    time_offset_ms: timeOffsetMs,
    prefer_data_from: preferDataFrom,
  });
  return data;
}

// Metrics
export async function getMetricsRange(
  start: string,
  end: string
): Promise<{ daily: DailyMetrics[]; current_ctl: number; current_atl: number; current_tsb: number }> {
  const { data } = await api.get('/metrics/range', { params: { start, end } });
  return data;
}

export async function getPerformanceSnapshot(): Promise<PerformanceSnapshot> {
  const { data } = await api.get('/metrics/snapshot');
  return data;
}

export async function getWeeklySummaries(weeks: number = 12): Promise<WeeklySummary[]> {
  const { data } = await api.get('/metrics/weekly', { params: { weeks } });
  return data;
}

// Zones
export async function getHrMethods(): Promise<ZoneMethodInfo[]> {
  const { data } = await api.get('/zones/hr/methods');
  return data;
}

export async function getPowerMethods(): Promise<ZoneMethodInfo[]> {
  const { data } = await api.get('/zones/power/methods');
  return data;
}

export async function getHrZones(): Promise<ZoneResult> {
  const { data } = await api.get('/zones/hr');
  return data;
}

export async function getPowerZones(): Promise<ZoneResult> {
  const { data } = await api.get('/zones/power');
  return data;
}

export async function updateThresholds(thresholds: Record<string, number>) {
  const { data } = await api.put('/zones/thresholds', thresholds);
  return data;
}

export async function updateZoneConfig(config: Record<string, string>) {
  const { data } = await api.put('/zones/config', config);
  return data;
}

// Workouts
export async function getWorkouts(params?: { start?: string; end?: string }): Promise<PlannedWorkout[]> {
  const { data } = await api.get('/workouts', { params });
  return data;
}

export async function createWorkout(workout: Omit<PlannedWorkout, 'id' | 'completed' | 'activity_id'>) {
  const { data } = await api.post('/workouts', workout);
  return data;
}

export async function updateWorkout(id: string, updates: Partial<PlannedWorkout>) {
  const { data } = await api.put(`/workouts/${id}`, updates);
  return data;
}

export async function deleteWorkout(id: string) {
  await api.delete(`/workouts/${id}`);
}

// AI Coach
export async function chat(message: string, history: { role: string; content: string }[] = []) {
  const { data } = await api.post('/ai/chat', {
    message,
    conversation_history: history,
  });
  return data;
}

export async function chatStream(
  message: string,
  history: { role: string; content: string }[] = [],
  onChunk: (text: string) => void
) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE_URL}/api/v1/ai/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message, conversation_history: history }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.text) onChunk(data.text);
        } catch {
          // ignore parse errors
        }
      }
    }
  }
}

// AI Coach - Plan Modification
export async function getCoachingContext(): Promise<CoachingContext> {
  const { data } = await api.get('/ai/context');
  return data;
}

export async function analyzePlan(
  feedback: string,
  daysForward: number = 14,
  previousSuggestions?: Record<string, unknown>[]
): Promise<PlanModificationResponse> {
  const { data } = await api.post('/ai/plan/analyze', {
    feedback,
    days_forward: daysForward,
    previous_suggestions: previousSuggestions,
  });
  return data;
}

export async function generateWeeklyPlan(
  goals: string,
  constraints?: string,
  startDate?: string
): Promise<PlanModificationResponse> {
  const { data } = await api.post('/ai/plan/generate', {
    goals,
    constraints,
    start_date: startDate,
  });
  return data;
}

export async function applyPlanModifications(
  responseJson: Record<string, unknown>,
  dryRun: boolean = false
): Promise<ApplyModificationsResponse> {
  const { data } = await api.post('/ai/plan/apply', {
    response_json: responseJson,
    dry_run: dryRun,
  });
  return data;
}

export async function refinePlanSuggestions(
  originalResponse: Record<string, unknown>,
  refinementFeedback: string
): Promise<PlanModificationResponse> {
  const { data } = await api.post('/ai/plan/refine', {
    original_response: originalResponse,
    refinement_feedback: refinementFeedback,
  });
  return data;
}

export function getWorkoutFitUrl(workoutId: string): string {
  const token = localStorage.getItem('token');
  return `${API_BASE_URL}/api/v1/ai/workout/${workoutId}/fit?token=${token}`;
}

// AI Coach - Settings
export async function getCoachSettings(): Promise<CoachSettings> {
  const { data } = await api.get('/ai/settings');
  return data;
}

export async function updateCoachSettings(settings: Partial<CoachSettings>): Promise<CoachSettings> {
  const { data } = await api.put('/ai/settings', settings);
  return data;
}

// Integrations
export async function getGarminConnectUrl() {
  const { data } = await api.get('/integrations/garmin/connect');
  return data;
}

export async function getConcept2ConnectUrl() {
  const { data } = await api.get('/integrations/concept2/connect');
  return data;
}

export async function syncGarmin() {
  const { data } = await api.post('/integrations/garmin/sync');
  return data;
}

export async function syncConcept2() {
  const { data } = await api.post('/integrations/concept2/sync');
  return data;
}

export async function disconnectGarmin() {
  const { data } = await api.delete('/integrations/garmin/disconnect');
  return data;
}

export async function disconnectConcept2() {
  const { data } = await api.delete('/integrations/concept2/disconnect');
  return data;
}

export default api;
