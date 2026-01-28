"""Parse .FIT files into Activity documents."""

import hashlib
import io
from datetime import datetime, timezone

import fitdecode

from app.models.activity import Activity, RecordPoint, LapSummary

# Map FIT sport enum values to our sport names
SPORT_MAP = {
    "running": "running",
    "cycling": "cycling",
    "swimming": "swimming",
    "rowing": "rowing",
    "training": "strength",
    "generic": "other",
    "transition": "other",
    "fitness_equipment": "other",
    "walking": "walking",
    "hiking": "hiking",
    "e_biking": "cycling",
    "indoor_cycling": "cycling",
}

SUB_SPORT_MAP = {
    "indoor_rowing": "indoor_rowing",
    "indoor_cycling": "indoor_cycling",
    "treadmill": "treadmill",
    "road": "road",
    "trail": "trail",
    "track": "track",
    "open_water": "open_water",
    "lap_swimming": "pool",
    "mountain": "mountain",
    "gravel_cycling": "gravel",
}


async def parse_fit_file(
    file_bytes: bytes,
    user_id: str,
    filename: str | None = None,
) -> Activity:
    """Parse a FIT file and return an Activity document (not yet saved)."""
    file_hash = hashlib.sha256(file_bytes).hexdigest()

    records: list[RecordPoint] = []
    laps: list[LapSummary] = []
    session_data: dict = {}

    with fitdecode.FitReader(io.BytesIO(file_bytes)) as fit:
        for frame in fit:
            if not isinstance(frame, fitdecode.FitDataMessage):
                continue

            if frame.name == "session":
                session_data = _extract_session(frame)
            elif frame.name == "record":
                record = _extract_record(frame)
                if record:
                    records.append(record)
            elif frame.name == "lap":
                lap = _extract_lap(frame)
                if lap:
                    laps.append(lap)

    # Determine start/end times from records if session doesn't have them
    start_time = session_data.get("start_time")
    if not start_time and records:
        start_time = records[0].timestamp
    if not start_time:
        start_time = datetime.now(timezone.utc)

    end_time = session_data.get("end_time")
    if not end_time and records:
        end_time = records[-1].timestamp

    # Map sport
    raw_sport = session_data.get("sport", "other")
    sport = SPORT_MAP.get(str(raw_sport).lower(), "other")
    raw_sub_sport = session_data.get("sub_sport", "")
    sub_sport = SUB_SPORT_MAP.get(str(raw_sub_sport).lower())

    return Activity(
        user_id=user_id,
        source="upload",
        original_filename=filename,
        file_hash=file_hash,
        sport=sport,
        sub_sport=sub_sport,
        name=session_data.get("name") or f"{sport.title()} - {start_time.strftime('%b %d')}",
        start_time=start_time,
        end_time=end_time,
        total_timer_time=session_data.get("total_timer_time", 0),
        total_elapsed_time=session_data.get("total_elapsed_time"),
        total_distance=session_data.get("total_distance"),
        total_calories=session_data.get("total_calories"),
        avg_heart_rate=session_data.get("avg_heart_rate"),
        max_heart_rate=session_data.get("max_heart_rate"),
        avg_power=session_data.get("avg_power"),
        max_power=session_data.get("max_power"),
        avg_cadence=session_data.get("avg_cadence"),
        avg_speed=session_data.get("avg_speed"),
        max_speed=session_data.get("max_speed"),
        total_ascent=session_data.get("total_ascent"),
        total_descent=session_data.get("total_descent"),
        records=records,
        laps=laps,
    )


def _extract_session(frame: fitdecode.FitDataMessage) -> dict:
    """Extract session-level summary data."""
    data = {}
    field_map = {
        "sport": "sport",
        "sub_sport": "sub_sport",
        "start_time": "start_time",
        "timestamp": "end_time",
        "total_timer_time": "total_timer_time",
        "total_elapsed_time": "total_elapsed_time",
        "total_distance": "total_distance",
        "total_calories": "total_calories",
        "avg_heart_rate": "avg_heart_rate",
        "max_heart_rate": "max_heart_rate",
        "avg_power": "avg_power",
        "max_power": "max_power",
        "avg_cadence": "avg_cadence",
        "enhanced_avg_speed": "avg_speed",
        "enhanced_max_speed": "max_speed",
        "avg_speed": "avg_speed",
        "max_speed": "max_speed",
        "total_ascent": "total_ascent",
        "total_descent": "total_descent",
    }
    for fit_name, our_name in field_map.items():
        val = frame.get_value(fit_name)
        if val is not None and our_name not in data:
            data[our_name] = val
    return data


def _extract_record(frame: fitdecode.FitDataMessage) -> RecordPoint | None:
    """Extract a single time-series record point."""
    timestamp = frame.get_value("timestamp")
    if not timestamp:
        return None

    return RecordPoint(
        timestamp=timestamp,
        heart_rate=frame.get_value("heart_rate"),
        power=frame.get_value("power"),
        cadence=frame.get_value("cadence"),
        speed=frame.get_value("enhanced_speed") or frame.get_value("speed"),
        distance=frame.get_value("distance"),
        altitude=frame.get_value("enhanced_altitude") or frame.get_value("altitude"),
        latitude=_semicircles_to_degrees(frame.get_value("position_lat")),
        longitude=_semicircles_to_degrees(frame.get_value("position_long")),
        temperature=frame.get_value("temperature"),
    )


def _extract_lap(frame: fitdecode.FitDataMessage) -> LapSummary | None:
    """Extract lap summary data."""
    start_time = frame.get_value("start_time")
    timer_time = frame.get_value("total_timer_time")
    if not start_time or not timer_time:
        return None

    return LapSummary(
        start_time=start_time,
        total_timer_time=timer_time,
        total_distance=frame.get_value("total_distance"),
        avg_heart_rate=frame.get_value("avg_heart_rate"),
        max_heart_rate=frame.get_value("max_heart_rate"),
        avg_power=frame.get_value("avg_power"),
        max_power=frame.get_value("max_power"),
        avg_cadence=frame.get_value("avg_cadence"),
        avg_speed=frame.get_value("enhanced_avg_speed") or frame.get_value("avg_speed"),
    )


def _semicircles_to_degrees(val) -> float | None:
    """Convert Garmin semicircles to decimal degrees."""
    if val is None:
        return None
    return val * (180.0 / 2**31)
