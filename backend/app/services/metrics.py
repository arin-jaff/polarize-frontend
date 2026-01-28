"""Training metrics calculations: TSS, NP, CTL, ATL, TSB, hrTSS."""

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

import numpy as np

from app.models.activity import Activity
from app.models.user import User
from app.schemas.metrics import DailyMetrics, MetricsRange, PerformanceSnapshot, WeeklySummary

# TrainingPeaks hrTSS zone lookup: (lower % LTHR, upper % LTHR) -> TSS per hour
HR_ZONE_TSS_PER_HOUR = [
    (0.00, 0.81, 20),    # Zone 1 - Recovery
    (0.81, 0.89, 45),    # Zone 2 - Aerobic
    (0.89, 0.94, 60),    # Zone 3 - Tempo
    (0.94, 0.99, 75),    # Zone 4 - Sub-threshold
    (0.99, 1.02, 95),    # Zone 5a - Super-threshold
    (1.02, 1.06, 110),   # Zone 5b - Aerobic capacity
    (1.06, 2.00, 130),   # Zone 5c - Anaerobic
]

CTL_TIME_CONSTANT = 42  # days
ATL_TIME_CONSTANT = 7   # days


def compute_normalized_power(power_data: list[int | None], sample_rate_s: int = 1) -> float | None:
    """
    Compute Normalized Power (NP) from power time-series.
    NP = (mean(rolling_30s_power^4))^0.25
    """
    # Filter out None values
    powers = [p for p in power_data if p is not None and p > 0]
    if len(powers) < 30:
        return None

    arr = np.array(powers, dtype=np.float64)

    # 30-second rolling average
    window = max(1, 30 // sample_rate_s)
    if len(arr) < window:
        return None

    # Compute rolling average using convolution
    kernel = np.ones(window) / window
    rolling_avg = np.convolve(arr, kernel, mode="valid")

    # Raise to 4th power, take mean, take 4th root
    np_value = (np.mean(rolling_avg**4)) ** 0.25
    return float(np_value)


def compute_tss_from_power(
    normalized_power: float,
    duration_seconds: float,
    ftp: int,
) -> float:
    """
    TSS = IF^2 x Duration_hours x 100
    where IF = NP / FTP
    """
    intensity_factor = normalized_power / ftp
    duration_hours = duration_seconds / 3600.0
    return (intensity_factor**2) * duration_hours * 100.0


def compute_hr_tss(
    hr_data: list[int | None],
    duration_seconds: float,
    lthr: int,
    sample_rate_s: int = 1,
) -> float:
    """
    Compute hrTSS using zone-based TSS/hour lookup.
    For each sample, determine which HR zone it falls in,
    accumulate TSS proportionally.
    """
    if not lthr or lthr <= 0:
        return 0.0

    total_tss = 0.0
    valid_samples = 0

    for hr in hr_data:
        if hr is None or hr <= 0:
            continue
        valid_samples += 1
        hr_fraction = hr / lthr

        # Find matching zone
        tss_per_hour = 20  # default to Zone 1
        for lower, upper, zone_tss in HR_ZONE_TSS_PER_HOUR:
            if lower <= hr_fraction < upper:
                tss_per_hour = zone_tss
                break

        # Accumulate: each sample contributes (sample_rate / 3600) hours * TSS/hour
        total_tss += (sample_rate_s / 3600.0) * tss_per_hour

    return total_tss


async def compute_activity_metrics(activity: Activity, user: User) -> None:
    """Compute TSS, NP, IF, and scaled TSS for an activity. Modifies in place."""
    ftp = user.thresholds.threshold_power
    lthr = user.thresholds.threshold_hr

    # Try power-based TSS first (most accurate)
    if ftp and ftp > 0 and activity.records:
        power_data = [r.power for r in activity.records]
        has_power = any(p is not None and p > 0 for p in power_data)

        if has_power:
            np_value = compute_normalized_power(power_data)
            if np_value:
                activity.normalized_power = round(np_value, 1)
                activity.intensity_factor = round(np_value / ftp, 3)
                activity.tss = round(
                    compute_tss_from_power(np_value, activity.total_timer_time, ftp), 1
                )

    # Fall back to hrTSS if no power-based TSS
    if activity.tss is None and lthr and lthr > 0 and activity.records:
        hr_data = [r.heart_rate for r in activity.records]
        has_hr = any(h is not None and h > 0 for h in hr_data)

        if has_hr:
            activity.tss = round(
                compute_hr_tss(hr_data, activity.total_timer_time, lthr), 1
            )

    # Fall back to duration-based estimate if nothing else works
    if activity.tss is None:
        # Very rough estimate: ~50 TSS per hour for moderate effort
        activity.tss = round((activity.total_timer_time / 3600.0) * 50, 1)

    # Apply sport-specific scaling
    activity.scaled_tss = activity.tss  # default: no scaling
    for scaling in user.sport_scaling:
        if scaling.sport == activity.sport:
            activity.scaled_tss = round(activity.tss * scaling.scaling_factor, 1)
            break


async def compute_metrics_range(
    user_id: str,
    start: date,
    end: date,
    user: User,
) -> MetricsRange:
    """Compute daily CTL/ATL/TSB for a date range."""
    # We need activities going back far enough to build CTL (42-day window)
    lookback_start = start - timedelta(days=CTL_TIME_CONSTANT * 2)
    start_dt = datetime.combine(lookback_start, datetime.min.time()).replace(tzinfo=timezone.utc)
    end_dt = datetime.combine(end, datetime.max.time()).replace(tzinfo=timezone.utc)

    activities = await Activity.find(
        Activity.user_id == user_id,
        Activity.start_time >= start_dt,
        Activity.start_time <= end_dt,
    ).to_list()

    # Aggregate daily TSS
    daily_tss: dict[date, float] = defaultdict(float)
    for act in activities:
        day = act.start_time.date()
        daily_tss[day] += act.scaled_tss or act.tss or 0.0

    # Compute rolling CTL/ATL/TSB
    ctl = 0.0
    atl = 0.0
    daily_metrics: list[DailyMetrics] = []

    current = lookback_start
    while current <= end:
        tss_today = daily_tss.get(current, 0.0)

        ctl = ctl * (1 - 1 / CTL_TIME_CONSTANT) + tss_today * (1 / CTL_TIME_CONSTANT)
        atl = atl * (1 - 1 / ATL_TIME_CONSTANT) + tss_today * (1 / ATL_TIME_CONSTANT)
        tsb = ctl - atl

        if current >= start:
            daily_metrics.append(
                DailyMetrics(
                    date=current,
                    tss=tss_today,
                    scaled_tss=tss_today,
                    ctl=round(ctl, 1),
                    atl=round(atl, 1),
                    tsb=round(tsb, 1),
                )
            )

        current += timedelta(days=1)

    # Update user's current CTL/ATL
    user.current_ctl = round(ctl, 1)
    user.current_atl = round(atl, 1)
    await user.save()

    return MetricsRange(
        start_date=start,
        end_date=end,
        daily=daily_metrics,
        current_ctl=round(ctl, 1),
        current_atl=round(atl, 1),
        current_tsb=round(ctl - atl, 1),
    )


async def get_performance_snapshot(user_id: str, user: User) -> PerformanceSnapshot:
    """Get current performance metrics."""
    today = date.today()

    # Compute metrics up to today
    metrics = await compute_metrics_range(user_id, today - timedelta(days=90), today, user)

    # Aggregate recent periods
    tss_7d = sum(d.tss for d in metrics.daily[-7:])
    tss_28d = sum(d.tss for d in metrics.daily[-28:])

    duration_7d = 0.0
    distance_7d = 0.0

    recent_start = datetime.combine(today - timedelta(days=7), datetime.min.time()).replace(
        tzinfo=timezone.utc
    )
    recent_activities = await Activity.find(
        Activity.user_id == user_id,
        Activity.start_time >= recent_start,
    ).to_list()
    for act in recent_activities:
        duration_7d += act.total_timer_time or 0
        distance_7d += act.total_distance or 0

    # Ramp rates (CTL change per week)
    daily = metrics.daily
    ramp_7d = (daily[-1].ctl - daily[-8].ctl) if len(daily) >= 8 else 0
    ramp_28d = (daily[-1].ctl - daily[-29].ctl) / 4 if len(daily) >= 29 else 0
    ramp_90d = (daily[-1].ctl - daily[0].ctl) / (len(daily) / 7) if daily else 0

    return PerformanceSnapshot(
        fitness=metrics.current_ctl,
        fatigue=metrics.current_atl,
        form=metrics.current_tsb,
        total_tss_7d=round(tss_7d, 1),
        total_tss_28d=round(tss_28d, 1),
        total_duration_7d=duration_7d,
        total_distance_7d=distance_7d,
        ramp_rate_7d=round(ramp_7d, 1),
        ramp_rate_28d=round(ramp_28d, 1),
        ramp_rate_90d=round(ramp_90d, 1),
    )


async def get_weekly_summaries(user_id: str, weeks: int) -> list[WeeklySummary]:
    """Get weekly training summaries."""
    today = date.today()
    # Monday of current week
    week_start = today - timedelta(days=today.weekday())
    start = week_start - timedelta(weeks=weeks - 1)

    start_dt = datetime.combine(start, datetime.min.time()).replace(tzinfo=timezone.utc)
    activities = await Activity.find(
        Activity.user_id == user_id,
        Activity.start_time >= start_dt,
    ).to_list()

    # Group by week
    weekly: dict[date, dict] = {}
    for i in range(weeks):
        ws = start + timedelta(weeks=i)
        weekly[ws] = {
            "total_tss": 0.0,
            "total_scaled_tss": 0.0,
            "total_duration": 0.0,
            "total_distance": 0.0,
            "activity_count": 0,
            "by_sport": defaultdict(float),
        }

    for act in activities:
        act_date = act.start_time.date()
        act_week_start = act_date - timedelta(days=act_date.weekday())
        if act_week_start in weekly:
            w = weekly[act_week_start]
            tss = act.tss or 0.0
            scaled = act.scaled_tss or tss
            w["total_tss"] += tss
            w["total_scaled_tss"] += scaled
            w["total_duration"] += act.total_timer_time or 0
            w["total_distance"] += act.total_distance or 0
            w["activity_count"] += 1
            w["by_sport"][act.sport] += tss

    return [
        WeeklySummary(
            week_start=ws,
            total_tss=round(w["total_tss"], 1),
            total_scaled_tss=round(w["total_scaled_tss"], 1),
            total_duration=w["total_duration"],
            total_distance=w["total_distance"],
            activity_count=w["activity_count"],
            by_sport=dict(w["by_sport"]),
        )
        for ws, w in sorted(weekly.items())
    ]
