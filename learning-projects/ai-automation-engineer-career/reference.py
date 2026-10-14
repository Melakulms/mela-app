def reconcile(task_status, cancel_requested=False):
    """Decision simulator; performs no reservation or external action."""
    if task_status not in ("exists", "absent", "unknown"):
        raise ValueError("Unrecognized task state")
    if type(cancel_requested) is not bool:
        raise ValueError("Cancellation flag must be boolean")
    if task_status == "unknown":
        return "reconcile_needed"
    if cancel_requested:
        return "cancel_task_first" if task_status == "exists" else "release_reservation"
    return "record_existing_task" if task_status == "exists" else "create_with_same_operation_id"
