// User types
export interface CoachSettings {
  coach_type: 'specialist' | 'generalist' | 'recreational';
  training_plan: 'polarized' | 'traditional' | 'threshold';
  time_constraint: 'minimal' | 'moderate' | 'committed' | 'serious' | 'elite';
  weekly_hours_available?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  primary_sport: string;
  coach_settings?: CoachSettings;
}

export interface ThresholdValues {
  threshold_hr?: number;
  max_hr?: number;
  resting_hr?: number;
  threshold_power?: number;
  running_threshold_power?: number;
  critical_power?: number;
}

// Activity types
export interface ActivitySummary {
  id: string;
  sport: string;
  sub_sport?: string;
  name?: string;
  start_time: string;
  total_timer_time: number;
  total_distance?: number;
  avg_heart_rate?: number;
  avg_power?: number;
  normalized_power?: number;
  tss?: number;
  scaled_tss?: number;
  source: string;
}

export interface ActivityDetail extends ActivitySummary {
  end_time?: string;
  total_elapsed_time?: number;
  total_calories?: number;
  max_heart_rate?: number;
  max_power?: number;
  avg_cadence?: number;
  avg_speed?: number;
  max_speed?: number;
  total_ascent?: number;
  total_descent?: number;
  avg_stroke_rate?: number;
  intensity_factor?: number;
  description?: string;
  is_combined: boolean;
  has_records: boolean;
}

export interface RecordPoint {
  timestamp: string;
  heart_rate?: number;
  power?: number;
  cadence?: number;
  speed?: number;
  distance?: number;
  altitude?: number;
}

// Metrics types
export interface DailyMetrics {
  date: string;
  tss: number;
  scaled_tss: number;
  ctl: number;
  atl: number;
  tsb: number;
}

export interface PerformanceSnapshot {
  fitness: number;
  fatigue: number;
  form: number;
  total_tss_7d: number;
  total_tss_28d: number;
  total_duration_7d: number;
  total_distance_7d: number;
  ramp_rate_7d: number;
  ramp_rate_28d: number;
  ramp_rate_90d: number;
}

export interface WeeklySummary {
  week_start: string;
  total_tss: number;
  total_scaled_tss: number;
  total_duration: number;
  total_distance: number;
  activity_count: number;
  by_sport: Record<string, number>;
}

// Zone types
export interface Zone {
  zone_number: number;
  name: string;
  lower: number;
  upper: number;
}

export interface ZoneResult {
  method: string;
  activity: string;
  threshold_type: string;
  threshold_value: number;
  zones: Zone[];
}

export interface ZoneMethodInfo {
  method_id: string;
  name: string;
  zone_count: number;
  threshold_type: string;
  supports: string[];
}

// Workout types
export interface WorkoutStep {
  step_type: string;
  duration_type: string;
  duration_value?: number;
  target_type?: string;
  target_low?: number;
  target_high?: number;
  notes?: string;
}

export interface PlannedWorkout {
  id: string;
  scheduled_date: string;
  completed: boolean;
  activity_id?: string;
  name: string;
  description?: string;
  sport: string;
  estimated_duration?: number;
  estimated_tss?: number;
  steps: WorkoutStep[];
  pre_activity_comments?: string;
  post_activity_comments?: string;
}

// Chat types
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// AI Coach types
export interface AthleteContext {
  name: string;
  primary_sport: string;
  fitness_ctl: number;
  fatigue_atl: number;
  form_tsb: number;
  form_status: string;
  form_description: string;
}

export interface RecentActivitySummary {
  date: string;
  sport: string;
  name?: string;
  duration_minutes: number;
  tss?: number;
  avg_hr_bpm?: number;
  np_watts?: number;
}

export interface UpcomingWorkoutSummary {
  id: string;
  date: string;
  name: string;
  sport: string;
  duration_minutes?: number;
  estimated_tss?: number;
  description?: string;
}

export interface CoachingContext {
  athlete: AthleteContext;
  recent_activities: RecentActivitySummary[];
  upcoming_workouts: UpcomingWorkoutSummary[];
}

export interface ModificationPreview {
  type: string;
  action?: string;
  workout_id?: string;
  date: string;
  original_name?: string;
  new_name?: string;
  sport?: string;
  duration_minutes?: number;
  estimated_tss?: number;
  details?: Record<string, { from?: string | number; to: string | number }>;
  notes?: string;
}

export interface LoadAdjustment {
  current_weekly_tss?: number;
  recommended_weekly_tss?: number;
  reason?: string;
}

export interface PlanModificationResponse {
  success: boolean;
  summary?: string;
  athlete_message?: string;
  modifications: ModificationPreview[];
  load_adjustment?: LoadAdjustment;
  raw_response: Record<string, unknown>;
  errors: string[];
}

export interface ApplyModificationsResponse {
  success: boolean;
  modified_workouts: string[];
  created_workouts: string[];
  skipped_workouts: string[];
  errors: string[];
  warnings: string[];
}
