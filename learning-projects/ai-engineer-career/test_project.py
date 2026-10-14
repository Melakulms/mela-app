import importlib
import sys
import unittest

use_reference = "--reference" in sys.argv
if use_reference:
    sys.argv.remove("--reference")
project = importlib.import_module("reference" if use_reference else "starter")

class ProjectTests(unittest.TestCase):
    def test_valid_is_not_published(self):
        result = project.validate_event({"event":"Club","date":"2026-10-16","room":"2"})
        self.assertEqual(result["state"], "ready_for_review")

    def test_missing_date(self):
        result = project.validate_event({"event":"Club","date":None,"room":"2"})
        self.assertEqual(result["state"], "needs_review")

    def test_invalid_calendar_date(self):
        with self.assertRaises(ValueError):
            project.validate_event({"event":"Club","date":"2026-02-30","room":"2"})

    def test_extra_fields_rejected(self):
        with self.assertRaises(ValueError):
            project.validate_event({"event":"Club","date":None,"room":"2","published":True})

    def test_wrong_type_rejected(self):
        with self.assertRaises(ValueError):
            project.validate_event({"event":"Club","date":123,"room":"2"})

if __name__ == "__main__":
    unittest.main()
