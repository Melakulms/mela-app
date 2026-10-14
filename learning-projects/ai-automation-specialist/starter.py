class ReminderQueue:
    def __init__(self):
        self.jobs = {}
        self.sent = []

    def receive(self, event_id, text):
        raise NotImplementedError("Implement receive")

    def approve(self, event_id):
        raise NotImplementedError("Implement approve")

    def send(self, event_id):
        raise NotImplementedError("Implement send")
