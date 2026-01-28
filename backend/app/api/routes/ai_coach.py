"""
AI Coach API Routes

Provides endpoints for:
- Basic chat with the AI coach
- Plan modification suggestions (using coach personalities)
- Applying modifications to workouts
- Generating workout FIT files
- Iterative refinement of suggestions
- Coach settings management
"""

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
import httpx

from app.core.auth import get_current_user
from app.core.config import settings
from app.models.user import User
from app.schemas.ai_coach import (
    ChatRequest,
    ChatResponse,
    PlanModificationRequest,
    PlanModificationResponse,
    WeeklyPlanRequest,
    ApplyModificationsRequest,
    ApplyModificationsResponse,
    RefineRequest,
    CoachingContext,
    AthleteContext,
    ModificationPreview,
    LoadAdjustment,
    CoachSettingsUpdate,
    CoachSettingsResponse,
)
from app.services.context_builder import (
    build_coaching_context,
    build_plan_modification_prompt,
    build_weekly_plan_prompt,
)
from app.services.workout_modifier import (
    parse_ai_response,
    apply_modifications,
    generate_modification_preview,
)
from app.services.fit_generator import generate_workout_file

router = APIRouter()


# --- Ollama Interaction ---


async def _call_ollama_with_system(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.3,  # Lower temp for more consistent JSON
) -> dict:
    """Call Ollama API with separate system and user prompts."""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    payload = {
        "model": settings.ollama_model_name,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": temperature,
            "top_p": 0.9,
            "num_predict": 4096,  # Allow longer responses for full JSON
        },
    }

    async with httpx.AsyncClient(timeout=180.0) as client:
        try:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/chat",
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.ConnectError:
            raise HTTPException(
                status_code=503,
                detail="AI coach is not available. Ensure Ollama is running.",
            )
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"AI coach error: {str(e)}")


def _build_chat_system_prompt(user: User) -> str:
    """Build system prompt for general chat (not plan modifications)."""
    # Build base prompt without JSON schema (chat doesn't need JSON output)
    base = f"""You are an AI endurance coach specializing in {user.primary_sport.upper()}.

ATHLETE PROFILE:
- Name: {user.name}
- Primary Sport: {user.primary_sport}
- Current Fitness (CTL): {user.current_ctl:.0f}
- Current Fatigue (ATL): {user.current_atl:.0f}
- Current Form (TSB): {user.current_ctl - user.current_atl:.0f}
"""

    if user.thresholds.threshold_hr:
        base += f"- LTHR: {user.thresholds.threshold_hr} bpm\n"
    if user.thresholds.threshold_power:
        base += f"- FTP: {user.thresholds.threshold_power}W\n"

    base += """
COACHING STYLE:
- Be direct and straightforward
- Focus on the athlete's primary sport
- Consider their current form when giving advice
- For general questions, provide educational and practical answers
"""

    return base


def _build_chat_messages(user: User, request: ChatRequest) -> list[dict]:
    """Build message list for basic chat."""
    system = _build_chat_system_prompt(user)
    messages = [{"role": "system", "content": system}]
    messages.extend([{"role": m.role, "content": m.content} for m in request.conversation_history])
    messages.append({"role": "user", "content": request.message})
    return messages


async def _call_ollama_chat(messages: list[dict], stream: bool = False):
    """Call Ollama API for chat (with streaming support)."""
    payload = {
        "model": settings.ollama_model_name,
        "messages": messages,
        "stream": stream,
        "options": {"temperature": 0.7, "top_p": 0.9, "num_predict": 2048},
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            if stream:
                return client.stream(
                    "POST",
                    f"{settings.ollama_base_url}/api/chat",
                    json=payload,
                )
            else:
                resp = await client.post(
                    f"{settings.ollama_base_url}/api/chat",
                    json=payload,
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError:
            raise HTTPException(
                status_code=503,
                detail="AI coach is not available. Ensure Ollama is running.",
            )
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"AI coach error: {str(e)}")


# --- Basic Chat Endpoints ---


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, user: User = Depends(get_current_user)):
    """Send a message to the AI coach and get a response."""
    messages = _build_chat_messages(user, request)
    data = await _call_ollama_chat(messages, stream=False)
    return ChatResponse(response=data["message"]["content"])


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest, user: User = Depends(get_current_user)):
    """Stream a response from the AI coach."""
    messages = _build_chat_messages(user, request)

    async def generate():
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                async with client.stream(
                    "POST",
                    f"{settings.ollama_base_url}/api/chat",
                    json={
                        "model": settings.ollama_model_name,
                        "messages": messages,
                        "stream": True,
                        "options": {"temperature": 0.7, "top_p": 0.9, "num_predict": 2048},
                    },
                ) as resp:
                    async for line in resp.aiter_lines():
                        if line:
                            data = json.loads(line)
                            if not data.get("done", False):
                                yield f"data: {json.dumps({'text': data['message']['content']})}\n\n"
                            else:
                                yield "data: [DONE]\n\n"
            except httpx.ConnectError:
                yield f"data: {json.dumps({'error': 'AI coach is not available'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# --- Context Endpoint ---


@router.get("/context", response_model=CoachingContext)
async def get_coaching_context(user: User = Depends(get_current_user)):
    """Get the current coaching context for display in the UI."""
    context = await build_coaching_context(user)

    return CoachingContext(
        athlete=AthleteContext(
            name=context["athlete"]["name"],
            primary_sport=context["athlete"]["primary_sport"],
            fitness_ctl=context["current_metrics"]["fitness_ctl"],
            fatigue_atl=context["current_metrics"]["fatigue_atl"],
            form_tsb=context["current_metrics"]["form_tsb"],
            form_status=context["current_metrics"]["form_status"],
            form_description=context["current_metrics"]["form_description"],
        ),
        recent_activities=context.get("recent_activities", []),
        upcoming_workouts=context.get("upcoming_workouts", []),
    )


# --- Plan Modification Endpoints ---


@router.post("/plan/analyze", response_model=PlanModificationResponse)
async def analyze_plan(
    request: PlanModificationRequest,
    user: User = Depends(get_current_user),
):
    """
    Analyze the current training plan and suggest modifications.

    Uses the user's configured coach personality (specialist, polarized, etc.)
    to provide recommendations that match their training philosophy.
    """
    # Build full context
    context = await build_coaching_context(
        user,
        include_recent_activities=True,
        include_upcoming_workouts=True,
        days_forward=request.days_forward,
    )

    # Build prompts using coach personality
    system_prompt, user_prompt = build_plan_modification_prompt(
        context=context,
        user_feedback=request.feedback,
        user=user,
        previous_suggestions=request.previous_suggestions,
    )

    # Call AI with structured prompts
    data = await _call_ollama_with_system(system_prompt, user_prompt)
    response_text = data["message"]["content"]

    # Parse response
    parsed, errors = parse_ai_response(response_text)

    if parsed is None:
        return PlanModificationResponse(
            success=False,
            errors=errors,
            raw_response={"raw_text": response_text},
        )

    # Generate preview
    preview = generate_modification_preview(parsed)

    # Build modification previews
    modifications = []
    for change in preview.get("changes", []):
        modifications.append(ModificationPreview(
            type=change.get("type"),
            action=change.get("action"),
            workout_id=change.get("workout_id"),
            date=change.get("date"),
            original_name=change.get("original_name"),
            new_name=change.get("name"),
            sport=change.get("sport"),
            duration_minutes=change.get("duration_minutes"),
            estimated_tss=change.get("estimated_tss"),
            details=change.get("details"),
            notes=change.get("notes"),
        ))

    load_adj = None
    if preview.get("load_adjustment"):
        load_adj = LoadAdjustment(**preview["load_adjustment"])

    return PlanModificationResponse(
        success=True,
        summary=preview.get("summary"),
        athlete_message=preview.get("athlete_message"),
        modifications=modifications,
        load_adjustment=load_adj,
        raw_response=parsed.model_dump(),
        errors=errors,
    )


@router.post("/plan/generate", response_model=PlanModificationResponse)
async def generate_weekly_plan(
    request: WeeklyPlanRequest,
    user: User = Depends(get_current_user),
):
    """
    Generate a new weekly training plan.

    Uses the user's configured coach personality and time constraints
    to create an appropriate training week.
    """
    # Build context
    context = await build_coaching_context(
        user,
        include_recent_activities=True,
        include_upcoming_workouts=False,  # We're creating new ones
    )

    # Build prompts using coach personality
    system_prompt, user_prompt = build_weekly_plan_prompt(
        context=context,
        goals=request.goals,
        user=user,
        constraints=request.constraints,
    )

    # Call AI with structured prompts
    data = await _call_ollama_with_system(system_prompt, user_prompt)
    response_text = data["message"]["content"]

    # Parse response
    parsed, errors = parse_ai_response(response_text)

    if parsed is None:
        return PlanModificationResponse(
            success=False,
            errors=errors,
            raw_response={"raw_text": response_text},
        )

    # Generate preview
    preview = generate_modification_preview(parsed)

    # Build modification previews
    modifications = []
    for change in preview.get("changes", []):
        modifications.append(ModificationPreview(
            type=change.get("type"),
            date=change.get("date"),
            new_name=change.get("name"),
            sport=change.get("sport"),
            duration_minutes=change.get("duration_minutes"),
            estimated_tss=change.get("estimated_tss"),
            notes=change.get("description"),
        ))

    return PlanModificationResponse(
        success=True,
        summary=parsed.plan_summary.focus if parsed.plan_summary else None,
        athlete_message=parsed.athlete_message,
        modifications=modifications,
        raw_response=parsed.model_dump(),
        errors=errors,
    )


@router.post("/plan/apply", response_model=ApplyModificationsResponse)
async def apply_plan_modifications(
    request: ApplyModificationsRequest,
    user: User = Depends(get_current_user),
):
    """
    Apply the AI's suggested modifications to the database.

    Use dry_run=True to validate without committing changes.
    """
    from app.services.workout_modifier import AICoachResponse

    try:
        parsed = AICoachResponse.model_validate(request.response_json)
    except Exception as e:
        return ApplyModificationsResponse(
            success=False,
            errors=[f"Invalid response format: {str(e)}"],
        )

    result = await apply_modifications(
        user_id=str(user.id),
        response=parsed,
        dry_run=request.dry_run,
    )

    return ApplyModificationsResponse(
        success=result.success,
        modified_workouts=result.modified_workouts,
        created_workouts=result.created_workouts,
        skipped_workouts=result.skipped_workouts,
        errors=result.errors,
        warnings=result.warnings,
    )


@router.post("/plan/refine", response_model=PlanModificationResponse)
async def refine_suggestions(
    request: RefineRequest,
    user: User = Depends(get_current_user),
):
    """
    Refine previous AI suggestions based on user feedback.

    This allows iterative refinement where the user can ask for adjustments
    to the AI's proposed changes before applying them.
    """
    # Build context
    context = await build_coaching_context(user)

    # Build prompts with previous suggestions
    system_prompt, user_prompt = build_plan_modification_prompt(
        context=context,
        user_feedback=request.refinement_feedback,
        user=user,
        previous_suggestions=[request.original_response],
    )

    # Call AI with structured prompts
    data = await _call_ollama_with_system(system_prompt, user_prompt)
    response_text = data["message"]["content"]

    # Parse response
    parsed, errors = parse_ai_response(response_text)

    if parsed is None:
        return PlanModificationResponse(
            success=False,
            errors=errors,
            raw_response={"raw_text": response_text},
        )

    # Generate preview
    preview = generate_modification_preview(parsed)

    modifications = []
    for change in preview.get("changes", []):
        modifications.append(ModificationPreview(
            type=change.get("type"),
            action=change.get("action"),
            workout_id=change.get("workout_id"),
            date=change.get("date"),
            original_name=change.get("original_name"),
            new_name=change.get("name"),
            sport=change.get("sport"),
            duration_minutes=change.get("duration_minutes"),
            estimated_tss=change.get("estimated_tss"),
            details=change.get("details"),
            notes=change.get("notes"),
        ))

    load_adj = None
    if preview.get("load_adjustment"):
        load_adj = LoadAdjustment(**preview["load_adjustment"])

    return PlanModificationResponse(
        success=True,
        summary=preview.get("summary"),
        athlete_message=preview.get("athlete_message"),
        modifications=modifications,
        load_adjustment=load_adj,
        raw_response=parsed.model_dump(),
        errors=errors,
    )


# --- FIT File Generation ---


@router.get("/workout/{workout_id}/fit")
async def download_workout_fit(
    workout_id: str,
    user: User = Depends(get_current_user),
):
    """
    Download a planned workout as a FIT file.

    The FIT file can be synced to a Garmin device or imported into
    other fitness platforms.
    """
    fit_data = await generate_workout_file(workout_id, str(user.id))

    if fit_data is None:
        raise HTTPException(status_code=404, detail="Workout not found")

    return Response(
        content=fit_data,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename=workout_{workout_id}.fit",
        },
    )


# --- Coach Settings Endpoints ---


@router.get("/settings", response_model=CoachSettingsResponse)
async def get_coach_settings(user: User = Depends(get_current_user)):
    """Get the current AI coach settings."""
    settings = user.coach_settings
    return CoachSettingsResponse(
        coach_type=settings.coach_type,
        training_plan=settings.training_plan,
        time_constraint=settings.time_constraint,
        weekly_hours_available=settings.weekly_hours_available,
    )


@router.put("/settings", response_model=CoachSettingsResponse)
async def update_coach_settings(
    request: CoachSettingsUpdate,
    user: User = Depends(get_current_user),
):
    """
    Update AI coach settings.

    Allows configuring:
    - Coach type (specialist, generalist, recreational)
    - Training plan type (polarized, traditional, threshold)
    - Time constraint (minimal, moderate, committed, serious, elite)
    - Specific weekly hours available
    """
    # Validate coach_type
    valid_coach_types = ["specialist", "generalist", "recreational"]
    if request.coach_type and request.coach_type not in valid_coach_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid coach_type. Must be one of: {valid_coach_types}",
        )

    # Validate training_plan
    valid_plans = ["polarized", "traditional", "threshold"]
    if request.training_plan and request.training_plan not in valid_plans:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid training_plan. Must be one of: {valid_plans}",
        )

    # Validate time_constraint
    valid_constraints = ["minimal", "moderate", "committed", "serious", "elite"]
    if request.time_constraint and request.time_constraint not in valid_constraints:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid time_constraint. Must be one of: {valid_constraints}",
        )

    # Update only provided fields
    if request.coach_type:
        user.coach_settings.coach_type = request.coach_type
    if request.training_plan:
        user.coach_settings.training_plan = request.training_plan
    if request.time_constraint:
        user.coach_settings.time_constraint = request.time_constraint
    if request.weekly_hours_available is not None:
        user.coach_settings.weekly_hours_available = request.weekly_hours_available

    await user.save()

    return CoachSettingsResponse(
        coach_type=user.coach_settings.coach_type,
        training_plan=user.coach_settings.training_plan,
        time_constraint=user.coach_settings.time_constraint,
        weekly_hours_available=user.coach_settings.weekly_hours_available,
    )
