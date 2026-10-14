from datetime import date
import re

def validate_event(payload):
    if not isinstance(payload, dict) or set(payload) != {"event", "date", "room"}:
        raise ValueError("Exactly event, date and room are required")
    for key in ("event", "room"):
        if payload[key] is not None and (not isinstance(payload[key], str) or not payload[key].strip()):
            raise ValueError("Text fields must be nonempty strings or None")
    day = payload["date"]
    if day is not None:
        if not isinstance(day, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
            raise ValueError("Use YYYY-MM-DD or None")
        date.fromisoformat(day)
    missing = any(payload[k] is None for k in ("event", "date", "room"))
    return {"fields": dict(payload),
            "state": "needs_review" if missing else "ready_for_review"}
