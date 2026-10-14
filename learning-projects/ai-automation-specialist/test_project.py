import importlib
import sys
import unittest

use_reference = "--reference" in sys.argv
if use_reference:
    sys.argv.remove("--reference")
project = importlib.import_module("reference" if use_reference else "starter")

class ProjectTests(unittest.TestCase):
    def test_duplicate_delivery(self):
        q = project.ReminderQueue()
        q.receive("E17","Reminder")
        q.receive("E17","Reminder")
        self.assertEqual(len(q.jobs), 1)

    def test_approval_required(self):
        q = project.ReminderQueue()
        q.receive("E17","Reminder")
        with self.assertRaises(PermissionError):
            q.send("E17")
        self.assertEqual(q.sent, [])

    def test_repeated_send_is_noop(self):
        q = project.ReminderQueue()
        q.receive("E17","Reminder")
        q.approve("E17")
        self.assertTrue(q.send("E17"))
        self.assertFalse(q.send("E17"))
        self.assertEqual(q.sent, ["E17"])

    def test_changed_payload_rejected(self):
        q = project.ReminderQueue()
        q.receive("E17","Reminder")
        with self.assertRaises(ValueError):
            q.receive("E17","Changed message")

if __name__ == "__main__":
    unittest.main()
