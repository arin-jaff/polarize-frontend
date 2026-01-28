"""
Context Builder Service

Builds structured prompts for the AI coach by fetching and formatting
user data, recent activities, upcoming workouts, and current metrics.

Now integrates with coach_prompts for personality-specific prompts.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

from app.models.user import User
from app.models.activity import Activity
from app.models.workout import PlannedWorkout
from app.services.coach_prompts import (
    CoachType,
    TrainingPlanType,
    TimeConstraint,
    build_analysis_prompt as build_coach_analysis_prompt,
    build_weekly_plan_prompt as build_coach_weekly_prompt,
)


async def build_coaching_context(
    user: User,
    include_recent_activities: bool = True,
    include_upcoming_workouts: bool = True,
    days_back: int = 7,
    days_forward: int = 14,
) -> dict:
    """
    Build a comprehensive context dictionary for the AI coach.

    Returns a structured dict that can be serialized to JSON and included
    in the system prompt.
    """
    now = datetime.now(timezone.utc)

    context = {
        "athlete": _build_athlete_profile(user),
        "current_metrics": _build_current_metrics(user),
        "coach_settings": _build_coach_settings(user),
        "timestamp": now.isoformat(),
    }

    if include_recent_activities:
        context["recent_activities"] = await _get_recent_activities(
            user.id, now - timedelta(days=days_back), now
        )

    if include_upcoming_workouts:
        context["upcoming_workouts"] = await _get_upcoming_workouts(
            user.id, now, now + timedelta(days=days_forward)
        )

    return context


def _build_athlete_profile(user: User) -> dict:
    """Extract athlete profile information."""
    profile = {
        "name": user.name,
        "primary_sport": user.primary_sport,
    }

    # Add thresholds if set
    thresholds = {}
    if user.thresholds.threshold_hr:
        thresholds["lthr_bpm"] = user.thresholds.threshold_hr
    if user.thresholds.max_hr:
        thresholds["max_hr_bpm"] = user.thresholds.max_hr
    if user.thresholds.resting_hr:
        thresholds["resting_hr_bpm"] = user.thresholds.resting_hr
    if user.thresholds.threshold_power:
        thresholds["ftp_watts"] = user.thresholds.threshold_power
    if user.thresholds.running_threshold_power:
        thresholds["rftp_watts"] = user.thresholds.running_threshold_power
    if user.thresholds.critical_power:
        thresholds["critical_power_watts"] = user.thresholds.critical_power

    if thresholds:
        profile["thresholds"] = thresholds

    # Add sport scaling factors
    if user.sport_scaling:
        profile["sport_scaling"] = {
            s.sport: s.scaling_factor for s in user.sport_scaling
        }

    return profile


def _build_current_metrics(user: User) -> dict:
    """Build current fitness/fatigue/form metrics."""
    ctl = user.current_ctl
    atl = user.current_atl
    tsb = ctl - atl

    # Categorize form based on specialist coach TSB ranges
    if tsb < -35:
        form_status = "overtrained"
        form_description = "Dangerous fatigue level - mandatory recovery required"
    elif tsb < -30:
        form_status = "very_fatigued"
        form_description = "Approaching overtraining threshold - reduce load"
    elif tsb < -15:
        form_status = "building"
        form_description = "Optimal building range - this is where gains happen"
    elif tsb < 0:
        form_status = "maintaining"
        form_description = "Maintenance zone - steady training"
    elif tsb < 15:
        form_status = "fresh"
        form_description = "Well recovered - ready for hard efforts"
    else:
        form_status = "detraining"
        form_description = "Too fresh - increase training load"

    return {
        "fitness_ctl": round(ctl, 1),
        "fatigue_atl": round(atl, 1),
        "form_tsb": round(tsb, 1),
        "form_status": form_status,
        "form_description": form_description,
    }


def _build_coach_settings(user: User) -> dict:
    """Build coach settings from user preferences."""
    settings = user.coach_settings
    return {
        "coach_type": settings.coach_type,
        "training_plan": settings.training_plan,
        "time_constraint": settings.time_constraint,
        "weekly_hours": settings.weekly_hours_available,
    }


async def _get_recent_activities(
    user_id: str,
    start: datetime,
    end: datetime,
) -> list[dict]:
    """Fetch and summarize recent activities."""
    activities = await Activity.find(
        Activity.user_id == str(user_id),
        Activity.start_time >= start,
        Activity.start_time <= end,
    ).sort(-Activity.start_time).to_list()

    summaries = []
    for act in activities:
        summary = {
            "date": act.start_time.strftime("%Y-%m-%d"),
            "sport": act.sport,
            "duration_minutes": round(act.total_timer_time / 60, 1),
        }

        if act.name:
            summary["name"] = act.name
        if act.tss:
            summary["tss"] = round(act.tss, 1)
        if act.avg_heart_rate:
            summary["avg_hr_bpm"] = act.avg_heart_rate
        if act.normalized_power:
            summary["np_watts"] = round(act.normalized_power, 1)
        if act.total_distance:
            summary["distance_km"] = round(act.total_distance / 1000, 2)

        summaries.append(summary)

    return summaries


async def _get_upcoming_workouts(
    user_id: str,
    start: datetime,
    end: datetime,
) -> list[dict]:
    """Fetch and summarize upcoming planned workouts."""
    workouts = await PlannedWorkout.find(
        PlannedWorkout.user_id == str(user_id),
        PlannedWorkout.scheduled_date >= start,
        PlannedWorkout.scheduled_date <= end,
        PlannedWorkout.completed == False,
    ).sort(PlannedWorkout.scheduled_date).to_list()

    summaries = []
    for workout in workouts:
        summary = {
            "id": str(workout.id),
            "date": workout.scheduled_date.strftime("%Y-%m-%d"),
            "name": workout.name,
            "sport": workout.sport,
        }

        if workout.description:
            summary["description"] = workout.description
        if workout.estimated_duration:
            summary["duration_minutes"] = round(workout.estimated_duration / 60, 1)
        if workout.estimated_tss:
            summary["estimated_tss"] = round(workout.estimated_tss, 1)
        if workout.steps:
            summary["step_count"] = len(workout.steps)
            summary["steps"] = [
                {
                    "type": step.step_type,
                    "duration_type": step.duration_type,
                    "duration_value": step.duration_value,
                    "target_type": step.target_type,
                    "target_low": step.target_low,
                    "target_high": step.target_high,
                }
                for step in workout.steps
            ]

        summaries.append(summary)

    return summaries


def _get_coach_enums(user: User) -> tuple[CoachType, TrainingPlanType, TimeConstraint]:
    """Convert user settings strings to enums."""
    settings = user.coach_settings

    try:
        coach_type = CoachType(settings.coach_type)
    except ValueError:
        coach_type = CoachType.SPECIALIST

    try:
        training_plan = TrainingPlanType(settings.training_plan)
    except ValueError:
        training_plan = TrainingPlanType.POLARIZED

    try:
        time_constraint = TimeConstraint(settings.time_constraint)
    except ValueError:
        time_constraint = TimeConstraint.MODERATE

    return coach_type, training_plan, time_constraint


def build_plan_modification_prompt(
    context: dict,
    user_feedback: str,
    user: User,
    previous_suggestions: Optional[list[dict]] = None,
) -> tuple[str, str]:
    """
    Build the system and user prompts for plan modification requests.

    Uses coach personality from user settings.

    Returns: (system_prompt, user_prompt)
    """
    coach_type, training_plan, time_constraint = _get_coach_enums(user)

    system_prompt, user_prompt = build_coach_analysis_prompt(
        context=context,
        user_feedback=user_feedback,
        coach_type=coach_type,
        training_plan=training_plan,
        time_constraint=time_constraint,
    )

    # Add previous suggestions context if refining
    if previous_suggestions:
        import json
        user_prompt += f"""

PREVIOUS SUGGESTIONS (athlete requested changes):
{json.dumps(previous_suggestions, indent=2)}

Refine your recommendations based on the athlete's feedback.
"""

    return system_prompt, user_prompt


def build_weekly_plan_prompt(
    context: dict,
    goals: str,
    user: User,
    constraints: Optional[str] = None,
) -> tuple[str, str]:
    """
    Build prompt for generating a new weekly training plan.

    Uses coach personality from user settings.

    Returns: (system_prompt, user_prompt)
    """
    coach_type, training_plan, time_constraint = _get_coach_enums(user)

    return build_coach_weekly_prompt(
        context=context,
        goals=goals,
        constraints=constraints,
        coach_type=coach_type,
        training_plan=training_plan,
        time_constraint=time_constraint,
    )
