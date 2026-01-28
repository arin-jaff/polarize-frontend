"""
Workout Modifier Service

Parses structured JSON output from the AI coach and applies modifications
to planned workouts in the database. Includes validation and sanity checks.
"""

import json
import re
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field, ValidationError

from app.models.workout import PlannedWorkout, WorkoutStep


# --- Pydantic Models for LLM Output Validation ---


class DurationChange(BaseModel):
    from_value: Optional[float] = Field(None, alias="from")
    to_value: float = Field(..., alias="to")


class IntensityChange(BaseModel):
    from_value: Optional[str] = Field(None, alias="from")
    to_value: str = Field(..., alias="to")


class TSSChange(BaseModel):
    from_value: Optional[float] = Field(None, alias="from")
    to_value: float = Field(..., alias="to")


class WorkoutChanges(BaseModel):
    name: Optional[str] = None
    duration_minutes: Optional[DurationChange] = None
    intensity: Optional[IntensityChange] = None
    estimated_tss: Optional[TSSChange] = None
    notes: Optional[str] = None


class WorkoutModification(BaseModel):
    workout_id: str
    date: str
    original_name: Optional[str] = None
    action: str  # modify, skip, replace
    changes: Optional[WorkoutChanges] = None


class NewWorkoutStep(BaseModel):
    step_type: str
    duration_type: str
    duration_value: Optional[float] = None
    target_type: Optional[str] = None
    target_low: Optional[float] = None
    target_high: Optional[float] = None
    notes: Optional[str] = None


class NewWorkout(BaseModel):
    date: str
    day: Optional[str] = None
    name: str
    sport: str
    duration_minutes: float
    estimated_tss: Optional[float] = None
    description: Optional[str] = None
    steps: list[NewWorkoutStep] = Field(default_factory=list)


class WeeklyLoadAdjustment(BaseModel):
    current_weekly_tss: Optional[float] = None
    recommended_weekly_tss: Optional[float] = None
    reason: Optional[str] = None


class AnalysisSummary(BaseModel):
    current_status: Optional[str] = None
    key_concerns: list[str] = Field(default_factory=list)
    recommendations_summary: Optional[str] = None


class PlanSummary(BaseModel):
    focus: Optional[str] = None
    total_tss: Optional[float] = None
    total_hours: Optional[float] = None
    key_sessions: list[str] = Field(default_factory=list)


class AICoachResponse(BaseModel):
    """Full structured response from the AI coach."""
    analysis: Optional[AnalysisSummary] = None
    plan_summary: Optional[PlanSummary] = None
    modifications: list[WorkoutModification] = Field(default_factory=list)
    new_workouts: list[NewWorkout] = Field(default_factory=list)
    workouts: list[NewWorkout] = Field(default_factory=list)  # For weekly plan generation
    weekly_load_adjustment: Optional[WeeklyLoadAdjustment] = None
    athlete_message: Optional[str] = None


class ModificationResult(BaseModel):
    """Result of applying modifications."""
    success: bool
    modified_workouts: list[str] = Field(default_factory=list)
    created_workouts: list[str] = Field(default_factory=list)
    skipped_workouts: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


# --- Validation Functions ---


def validate_tss(tss: float) -> tuple[bool, Optional[str]]:
    """Validate TSS value is within reasonable bounds."""
    if tss < 0:
        return False, "TSS cannot be negative"
    if tss > 500:
        return False, f"TSS of {tss} is unrealistically high (max 500)"
    return True, None


def validate_duration(minutes: float) -> tuple[bool, Optional[str]]:
    """Validate duration is within reasonable bounds."""
    if minutes < 5:
        return False, "Duration must be at least 5 minutes"
    if minutes > 480:  # 8 hours
        return False, f"Duration of {minutes} minutes exceeds 8-hour maximum"
    return True, None


def validate_date(date_str: str) -> tuple[bool, Optional[str], Optional[datetime]]:
    """Validate and parse date string."""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        return True, None, dt
    except ValueError:
        return False, f"Invalid date format: {date_str}, expected YYYY-MM-DD", None


def validate_sport(sport: str) -> tuple[bool, Optional[str]]:
    """Validate sport type."""
    valid_sports = {"rowing", "cycling", "running", "swimming", "strength", "other", "rest"}
    if sport.lower() not in valid_sports:
        return False, f"Invalid sport: {sport}. Valid options: {valid_sports}"
    return True, None


def validate_step_type(step_type: str) -> tuple[bool, Optional[str]]:
    """Validate workout step type."""
    valid_types = {"warmup", "active", "recovery", "cooldown", "rest"}
    if step_type.lower() not in valid_types:
        return False, f"Invalid step type: {step_type}. Valid options: {valid_types}"
    return True, None


# --- JSON Extraction ---


def extract_json_from_response(response_text: str) -> Optional[dict]:
    """
    Extract JSON from LLM response, handling markdown code blocks
    and other common formatting issues.
    """
    # Try to find JSON in markdown code block
    json_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", response_text)
    if json_match:
        json_str = json_match.group(1).strip()
    else:
        # Try to find raw JSON (starts with { ends with })
        json_match = re.search(r"\{[\s\S]*\}", response_text)
        if json_match:
            json_str = json_match.group(0)
        else:
            return None

    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        # Try to fix common issues
        # Remove trailing commas before } or ]
        json_str = re.sub(r",\s*([}\]])", r"\1", json_str)
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            return None


def parse_ai_response(response_text: str) -> tuple[Optional[AICoachResponse], list[str]]:
    """
    Parse and validate AI coach response.

    Returns (parsed_response, errors).
    """
    errors = []

    # Extract JSON
    json_data = extract_json_from_response(response_text)
    if json_data is None:
        errors.append("Failed to extract valid JSON from AI response")
        return None, errors

    # Validate with Pydantic
    try:
        response = AICoachResponse.model_validate(json_data)
    except ValidationError as e:
        errors.append(f"Response validation failed: {str(e)}")
        return None, errors

    # Additional sanity checks
    for mod in response.modifications:
        if mod.action not in {"modify", "skip", "replace"}:
            errors.append(f"Invalid action '{mod.action}' for workout {mod.workout_id}")

    for workout in response.new_workouts + response.workouts:
        valid, err = validate_sport(workout.sport)
        if not valid:
            errors.append(err)

        valid, err = validate_duration(workout.duration_minutes)
        if not valid:
            errors.append(err)

        if workout.estimated_tss:
            valid, err = validate_tss(workout.estimated_tss)
            if not valid:
                errors.append(err)

    return response, errors


# --- Apply Modifications ---


async def apply_modifications(
    user_id: str,
    response: AICoachResponse,
    dry_run: bool = False,
) -> ModificationResult:
    """
    Apply AI coach modifications to the database.

    If dry_run=True, validates but doesn't commit changes.
    """
    result = ModificationResult(success=True)

    # Process modifications to existing workouts
    for mod in response.modifications:
        try:
            await _apply_single_modification(user_id, mod, result, dry_run)
        except Exception as e:
            result.errors.append(f"Error modifying workout {mod.workout_id}: {str(e)}")
            result.success = False

    # Process new workouts
    all_new = response.new_workouts + response.workouts
    for workout in all_new:
        try:
            await _create_new_workout(user_id, workout, result, dry_run)
        except Exception as e:
            result.errors.append(f"Error creating workout '{workout.name}': {str(e)}")
            result.success = False

    return result


async def _apply_single_modification(
    user_id: str,
    mod: WorkoutModification,
    result: ModificationResult,
    dry_run: bool,
) -> None:
    """Apply a single workout modification."""
    # Fetch the workout
    workout = await PlannedWorkout.get(mod.workout_id)

    if workout is None:
        result.errors.append(f"Workout {mod.workout_id} not found")
        result.success = False
        return

    if workout.user_id != user_id:
        result.errors.append(f"Workout {mod.workout_id} does not belong to user")
        result.success = False
        return

    if mod.action == "skip":
        if not dry_run:
            await workout.delete()
        result.skipped_workouts.append(mod.workout_id)
        return

    if mod.action in {"modify", "replace"} and mod.changes:
        changes = mod.changes

        if changes.name:
            workout.name = changes.name

        if changes.duration_minutes:
            valid, err = validate_duration(changes.duration_minutes.to_value)
            if valid:
                workout.estimated_duration = changes.duration_minutes.to_value * 60
            else:
                result.warnings.append(f"Skipping duration change: {err}")

        if changes.estimated_tss:
            valid, err = validate_tss(changes.estimated_tss.to_value)
            if valid:
                workout.estimated_tss = changes.estimated_tss.to_value
            else:
                result.warnings.append(f"Skipping TSS change: {err}")

        if changes.notes:
            workout.pre_activity_comments = changes.notes

        if not dry_run:
            await workout.save()

        result.modified_workouts.append(mod.workout_id)


async def _create_new_workout(
    user_id: str,
    workout_data: NewWorkout,
    result: ModificationResult,
    dry_run: bool,
) -> None:
    """Create a new planned workout."""
    # Parse date
    valid, err, scheduled_date = validate_date(workout_data.date)
    if not valid:
        result.errors.append(err)
        result.success = False
        return

    # Convert steps
    steps = []
    for step_data in workout_data.steps:
        valid, err = validate_step_type(step_data.step_type)
        if not valid:
            result.warnings.append(f"Skipping invalid step: {err}")
            continue

        step = WorkoutStep(
            step_type=step_data.step_type.lower(),
            duration_type=step_data.duration_type.lower(),
            duration_value=step_data.duration_value,
            target_type=step_data.target_type.lower() if step_data.target_type else None,
            target_low=step_data.target_low,
            target_high=step_data.target_high,
            notes=step_data.notes,
        )
        steps.append(step)

    workout = PlannedWorkout(
        user_id=user_id,
        scheduled_date=scheduled_date,
        name=workout_data.name,
        sport=workout_data.sport.lower(),
        description=workout_data.description,
        estimated_duration=workout_data.duration_minutes * 60,
        estimated_tss=workout_data.estimated_tss,
        steps=steps,
    )

    if not dry_run:
        await workout.insert()
        result.created_workouts.append(str(workout.id))
    else:
        result.created_workouts.append(f"[dry-run] {workout_data.name}")


# --- Preview Functions ---


def generate_modification_preview(
    response: AICoachResponse,
) -> dict:
    """
    Generate a human-readable preview of proposed changes.

    Returns a dict suitable for displaying to the user before confirmation.
    """
    preview = {
        "summary": response.analysis.recommendations_summary if response.analysis else None,
        "athlete_message": response.athlete_message,
        "changes": [],
    }

    # Modifications
    for mod in response.modifications:
        change = {
            "type": "modification",
            "action": mod.action,
            "workout_id": mod.workout_id,
            "date": mod.date,
            "original_name": mod.original_name,
        }

        if mod.changes:
            change["details"] = {}
            if mod.changes.duration_minutes:
                change["details"]["duration"] = {
                    "from": f"{mod.changes.duration_minutes.from_value} min",
                    "to": f"{mod.changes.duration_minutes.to_value} min",
                }
            if mod.changes.intensity:
                change["details"]["intensity"] = {
                    "from": mod.changes.intensity.from_value,
                    "to": mod.changes.intensity.to_value,
                }
            if mod.changes.estimated_tss:
                change["details"]["tss"] = {
                    "from": mod.changes.estimated_tss.from_value,
                    "to": mod.changes.estimated_tss.to_value,
                }
            if mod.changes.notes:
                change["notes"] = mod.changes.notes

        preview["changes"].append(change)

    # New workouts
    for workout in response.new_workouts + response.workouts:
        preview["changes"].append({
            "type": "new_workout",
            "date": workout.date,
            "name": workout.name,
            "sport": workout.sport,
            "duration_minutes": workout.duration_minutes,
            "estimated_tss": workout.estimated_tss,
            "description": workout.description,
            "step_count": len(workout.steps),
        })

    # Weekly load adjustment
    if response.weekly_load_adjustment:
        preview["load_adjustment"] = {
            "current": response.weekly_load_adjustment.current_weekly_tss,
            "recommended": response.weekly_load_adjustment.recommended_weekly_tss,
            "reason": response.weekly_load_adjustment.reason,
        }

    return preview
