class ReminderQueue:
    """Single-process classroom simulator. No email is sent."""
    def __init__(self):
        self.jobs = {}
        self.sent = []

    def receive(self, event_id, text):
        if not isinstance(event_id, str) or not event_id or not isinstance(text, str) or not text:
            raise ValueError("Nonempty event and text required")
        if event_id in self.jobs:
            if self.jobs[event_id]["text"] != text:
                raise ValueError("Same event ID with different content")
            return self.jobs[event_id]["state"]
        self.jobs[event_id] = {"text": text, "state": "awaiting_approval"}
        return "awaiting_approval"

    def approve(self, event_id):
        job = self.jobs[event_id]
        if job["state"] == "awaiting_approval":
            job["state"] = "approved"

    def send(self, event_id):
        job = self.jobs[event_id]
        if job["state"] == "sent":
            return False
        if job["state"] != "approved":
            raise PermissionError("Approval required")
        self.sent.append(event_id)
        job["state"] = "sent"
        return True
