import importlib
import sys
import unittest

use_reference = "--reference" in sys.argv
if use_reference:
    sys.argv.remove("--reference")
project = importlib.import_module("reference" if use_reference else "starter")

class ProjectTests(unittest.TestCase):
    def test_timeout_remains_unknown(self):
        self.assertEqual(project.reconcile("unknown"), "reconcile_needed")

    def test_existing_task_not_duplicated(self):
        self.assertEqual(project.reconcile("exists"), "record_existing_task")

    def test_cancellation_waits_for_reconciliation(self):
        self.assertEqual(project.reconcile("unknown", True), "reconcile_needed")
        self.assertEqual(project.reconcile("exists", True), "cancel_task_first")
        self.assertEqual(project.reconcile("absent", True), "release_reservation")

    def test_retry_identity_preserved(self):
        self.assertEqual(project.reconcile("absent"), "create_with_same_operation_id")

    def test_invalid_state(self):
        with self.assertRaises(ValueError):
            project.reconcile("probably failed")

if __name__ == "__main__":
    unittest.main()
