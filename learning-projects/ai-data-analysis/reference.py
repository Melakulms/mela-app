def summarize(rows):
    if not isinstance(rows, list):
        raise ValueError("Expected a list")
    seen = set()
    for row in rows:
        if not isinstance(row, dict) or set(row) != {"id", "attended", "passed"}:
            raise ValueError("Expected id, attended and passed fields")
        if not isinstance(row["id"], str) or not row["id"] or row["id"] in seen:
            raise ValueError("IDs must be unique nonempty strings")
        seen.add(row["id"])
        if type(row["attended"]) is not bool:
            raise ValueError("Attendance must be boolean")
        if row["passed"] is not None and type(row["passed"]) is not bool:
            raise ValueError("Result must be boolean or None")
        if not row["attended"] and row["passed"] is not None:
            raise ValueError("An absent learner cannot have a result in this exercise")
    attendees = [r for r in rows if r["attended"]]
    passed = sum(r["passed"] is True for r in attendees)
    unknown = sum(r["passed"] is None for r in attendees)
    return {"registered": len(rows), "attended": len(attendees),
            "recorded_passes": passed, "unknown_attendee_results": unknown,
            "recorded_pass_rate_attendees": passed / len(attendees) if attendees else None,
            "recorded_pass_rate_registrants": passed / len(rows) if rows else None}
