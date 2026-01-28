"""
FIT File Generator Service

Generates FIT workout files from planned workouts that can be synced
to Garmin devices or other fitness platforms.

Uses the FIT SDK to create properly formatted binary FIT files.
"""

import io
import struct
from datetime import datetime, timezone
from typing import Optional

from app.models.workout import PlannedWorkout, WorkoutStep


# FIT Protocol Constants
FIT_PROTOCOL_VERSION = 0x20  # 2.0
FIT_PROFILE_VERSION = 0x0814  # 20.84

# Message types
MESG_FILE_ID = 0
MESG_FILE_CREATOR = 1
MESG_WORKOUT = 26
MESG_WORKOUT_STEP = 27

# Field definitions
FILE_TYPE_WORKOUT = 5

# Base types
BASE_TYPE_ENUM = 0x00
BASE_TYPE_UINT8 = 0x00
BASE_TYPE_UINT16 = 0x84
BASE_TYPE_UINT32 = 0x86
BASE_TYPE_STRING = 0x07

# Workout step intensity
INTENSITY_ACTIVE = 0
INTENSITY_REST = 1
INTENSITY_WARMUP = 2
INTENSITY_COOLDOWN = 3
INTENSITY_RECOVERY = 4

# Duration types
WKT_STEP_DURATION_TIME = 0
WKT_STEP_DURATION_DISTANCE = 1
WKT_STEP_DURATION_CALORIES = 3
WKT_STEP_DURATION_OPEN = 28

# Target types
WKT_STEP_TARGET_HEART_RATE = 1
WKT_STEP_TARGET_POWER = 4
WKT_STEP_TARGET_SPEED = 0
WKT_STEP_TARGET_CADENCE = 3
WKT_STEP_TARGET_OPEN = 2


def _map_step_type_to_intensity(step_type: str) -> int:
    """Map our step type to FIT intensity."""
    mapping = {
        "warmup": INTENSITY_WARMUP,
        "active": INTENSITY_ACTIVE,
        "recovery": INTENSITY_RECOVERY,
        "cooldown": INTENSITY_COOLDOWN,
        "rest": INTENSITY_REST,
    }
    return mapping.get(step_type.lower(), INTENSITY_ACTIVE)


def _map_duration_type(duration_type: str) -> int:
    """Map our duration type to FIT duration type."""
    mapping = {
        "time": WKT_STEP_DURATION_TIME,
        "distance": WKT_STEP_DURATION_DISTANCE,
        "calories": WKT_STEP_DURATION_CALORIES,
        "open": WKT_STEP_DURATION_OPEN,
    }
    return mapping.get(duration_type.lower(), WKT_STEP_DURATION_OPEN)


def _map_target_type(target_type: Optional[str]) -> int:
    """Map our target type to FIT target type."""
    if not target_type:
        return WKT_STEP_TARGET_OPEN

    mapping = {
        "heart_rate": WKT_STEP_TARGET_HEART_RATE,
        "power": WKT_STEP_TARGET_POWER,
        "pace": WKT_STEP_TARGET_SPEED,
        "speed": WKT_STEP_TARGET_SPEED,
        "cadence": WKT_STEP_TARGET_CADENCE,
        "open": WKT_STEP_TARGET_OPEN,
    }
    return mapping.get(target_type.lower(), WKT_STEP_TARGET_OPEN)


def _sport_to_fit_sport(sport: str) -> int:
    """Map sport name to FIT sport enum."""
    mapping = {
        "cycling": 2,
        "running": 1,
        "swimming": 5,
        "rowing": 15,
        "strength": 20,
        "other": 0,
    }
    return mapping.get(sport.lower(), 0)


class FITEncoder:
    """
    Simple FIT file encoder for workout files.

    This is a minimal implementation focused on workout files.
    For production use, consider using the official Garmin FIT SDK.
    """

    def __init__(self):
        self.buffer = io.BytesIO()
        self.data_size = 0
        self.local_mesg_defs = {}
        self.next_local_mesg = 0

    def _write_header(self):
        """Write FIT file header."""
        # 14-byte header
        header_size = 14
        data_type = b".FIT"

        # We'll write a placeholder and update later
        self.buffer.write(struct.pack("<BBHI4s", header_size, FIT_PROTOCOL_VERSION, FIT_PROFILE_VERSION, 0, data_type))

        # CRC placeholder (2 bytes)
        self.buffer.write(struct.pack("<H", 0))

    def _calculate_crc(self, data: bytes) -> int:
        """Calculate FIT CRC."""
        crc_table = [
            0x0000, 0xCC01, 0xD801, 0x1400, 0xF001, 0x3C00, 0x2800, 0xE401,
            0xA001, 0x6C00, 0x7800, 0xB401, 0x5000, 0x9C01, 0x8801, 0x4400,
        ]
        crc = 0
        for byte in data:
            tmp = crc_table[crc & 0xF]
            crc = (crc >> 4) & 0x0FFF
            crc = crc ^ tmp ^ crc_table[byte & 0xF]
            tmp = crc_table[crc & 0xF]
            crc = (crc >> 4) & 0x0FFF
            crc = crc ^ tmp ^ crc_table[(byte >> 4) & 0xF]
        return crc

    def _write_definition(self, local_mesg: int, global_mesg: int, fields: list):
        """Write a definition message."""
        record_header = 0x40 | local_mesg  # Definition message flag
        num_fields = len(fields)

        self.buffer.write(struct.pack("<B", record_header))
        self.buffer.write(struct.pack("<xBHB", 0, global_mesg, num_fields))  # reserved, arch, global mesg, num fields

        for field_num, size, base_type in fields:
            self.buffer.write(struct.pack("<BBB", field_num, size, base_type))

        self.data_size += 5 + (num_fields * 3)

    def _write_data(self, local_mesg: int, data: bytes):
        """Write a data message."""
        record_header = local_mesg  # Data message
        self.buffer.write(struct.pack("<B", record_header))
        self.buffer.write(data)
        self.data_size += 1 + len(data)

    def _write_file_id(self, sport: int, timestamp: datetime):
        """Write file_id message."""
        local_mesg = 0

        # Fields: type, manufacturer, product, serial_number, time_created
        fields = [
            (0, 1, BASE_TYPE_ENUM),      # type
            (1, 2, BASE_TYPE_UINT16),    # manufacturer
            (2, 2, BASE_TYPE_UINT16),    # product
            (3, 4, BASE_TYPE_UINT32),    # serial_number
            (4, 4, BASE_TYPE_UINT32),    # time_created
        ]
        self._write_definition(local_mesg, MESG_FILE_ID, fields)

        # FIT timestamp is seconds since 1989-12-31 00:00:00 UTC
        fit_epoch = datetime(1989, 12, 31, 0, 0, 0, tzinfo=timezone.utc)
        fit_timestamp = int((timestamp - fit_epoch).total_seconds())

        data = struct.pack("<BHHII", FILE_TYPE_WORKOUT, 1, 1, 12345, fit_timestamp)
        self._write_data(local_mesg, data)

    def _write_workout(self, name: str, sport: int, num_steps: int):
        """Write workout message."""
        local_mesg = 1

        # Encode name (max 16 chars)
        name_bytes = name[:15].encode("utf-8") + b"\x00"
        name_bytes = name_bytes.ljust(16, b"\x00")

        fields = [
            (4, 1, BASE_TYPE_ENUM),      # sport
            (8, 16, BASE_TYPE_STRING),   # wkt_name
            (6, 2, BASE_TYPE_UINT16),    # num_valid_steps
        ]
        self._write_definition(local_mesg, MESG_WORKOUT, fields)

        data = struct.pack("<B", sport) + name_bytes + struct.pack("<H", num_steps)
        self._write_data(local_mesg, data)

    def _write_workout_step(
        self,
        step_index: int,
        intensity: int,
        duration_type: int,
        duration_value: Optional[float],
        target_type: int,
        target_low: Optional[float],
        target_high: Optional[float],
        notes: Optional[str],
    ):
        """Write workout_step message."""
        local_mesg = 2

        # Duration value is in milliseconds for time, meters for distance
        duration_val = 0
        if duration_value:
            if duration_type == WKT_STEP_DURATION_TIME:
                duration_val = int(duration_value * 1000)  # seconds to ms
            elif duration_type == WKT_STEP_DURATION_DISTANCE:
                duration_val = int(duration_value * 100)  # meters to cm
            else:
                duration_val = int(duration_value)

        # Target values (for HR: bpm, for power: watts, as custom values)
        target_low_val = int(target_low) if target_low else 0
        target_high_val = int(target_high) if target_high else 0

        fields = [
            (254, 2, BASE_TYPE_UINT16),  # message_index
            (0, 1, BASE_TYPE_ENUM),      # intensity
            (1, 1, BASE_TYPE_ENUM),      # duration_type
            (2, 4, BASE_TYPE_UINT32),    # duration_value
            (3, 1, BASE_TYPE_ENUM),      # target_type
            (4, 4, BASE_TYPE_UINT32),    # target_value (custom zone low)
            (5, 4, BASE_TYPE_UINT32),    # custom_target_value_low
            (6, 4, BASE_TYPE_UINT32),    # custom_target_value_high
        ]
        self._write_definition(local_mesg, MESG_WORKOUT_STEP, fields)

        data = struct.pack(
            "<HBBIBIIII",
            step_index,
            intensity,
            duration_type,
            duration_val,
            target_type,
            0,  # target_value (0 for custom)
            target_low_val,
            target_high_val,
        )
        self._write_data(local_mesg, data)

    def finalize(self) -> bytes:
        """Finalize the FIT file and return bytes."""
        # Get data
        self.buffer.seek(14)  # Skip header
        data = self.buffer.read()

        # Calculate data CRC
        data_crc = self._calculate_crc(data)

        # Write data CRC
        self.buffer.write(struct.pack("<H", data_crc))

        # Update header with data size
        self.buffer.seek(4)
        self.buffer.write(struct.pack("<I", self.data_size))

        # Calculate header CRC
        self.buffer.seek(0)
        header = self.buffer.read(12)
        header_crc = self._calculate_crc(header)
        self.buffer.seek(12)
        self.buffer.write(struct.pack("<H", header_crc))

        # Return full file
        self.buffer.seek(0)
        return self.buffer.read()


def generate_fit_workout(workout: PlannedWorkout) -> bytes:
    """
    Generate a FIT file from a planned workout.

    Returns the binary FIT file data.
    """
    encoder = FITEncoder()
    encoder._write_header()

    # File ID
    sport = _sport_to_fit_sport(workout.sport)
    timestamp = workout.scheduled_date

    encoder._write_file_id(sport, timestamp)

    # Workout definition
    num_steps = len(workout.steps) if workout.steps else 1
    encoder._write_workout(workout.name, sport, num_steps)

    # Workout steps
    if workout.steps:
        for i, step in enumerate(workout.steps):
            encoder._write_workout_step(
                step_index=i,
                intensity=_map_step_type_to_intensity(step.step_type),
                duration_type=_map_duration_type(step.duration_type),
                duration_value=step.duration_value,
                target_type=_map_target_type(step.target_type),
                target_low=step.target_low,
                target_high=step.target_high,
                notes=step.notes,
            )
    else:
        # Create a single open step if no steps defined
        duration_seconds = workout.estimated_duration or 3600
        encoder._write_workout_step(
            step_index=0,
            intensity=INTENSITY_ACTIVE,
            duration_type=WKT_STEP_DURATION_TIME,
            duration_value=duration_seconds,
            target_type=WKT_STEP_TARGET_OPEN,
            target_low=None,
            target_high=None,
            notes=None,
        )

    return encoder.finalize()


async def generate_workout_file(workout_id: str, user_id: str) -> Optional[bytes]:
    """
    Generate a FIT file for a specific workout.

    Returns None if workout not found or doesn't belong to user.
    """
    workout = await PlannedWorkout.get(workout_id)

    if workout is None:
        return None

    if workout.user_id != user_id:
        return None

    return generate_fit_workout(workout)


def generate_fit_from_plan(
    name: str,
    sport: str,
    duration_minutes: float,
    steps: list[dict],
    scheduled_date: Optional[datetime] = None,
) -> bytes:
    """
    Generate a FIT file directly from plan parameters.

    Useful for generating files from AI-created plans before saving to DB.
    """
    encoder = FITEncoder()
    encoder._write_header()

    fit_sport = _sport_to_fit_sport(sport)
    timestamp = scheduled_date or datetime.now(timezone.utc)

    encoder._write_file_id(fit_sport, timestamp)
    encoder._write_workout(name, fit_sport, len(steps) or 1)

    if steps:
        for i, step in enumerate(steps):
            encoder._write_workout_step(
                step_index=i,
                intensity=_map_step_type_to_intensity(step.get("step_type", "active")),
                duration_type=_map_duration_type(step.get("duration_type", "open")),
                duration_value=step.get("duration_value"),
                target_type=_map_target_type(step.get("target_type")),
                target_low=step.get("target_low"),
                target_high=step.get("target_high"),
                notes=step.get("notes"),
            )
    else:
        encoder._write_workout_step(
            step_index=0,
            intensity=INTENSITY_ACTIVE,
            duration_type=WKT_STEP_DURATION_TIME,
            duration_value=duration_minutes * 60,
            target_type=WKT_STEP_TARGET_OPEN,
            target_low=None,
            target_high=None,
            notes=None,
        )

    return encoder.finalize()
