import importlib
import sys
import unittest

use_reference = "--reference" in sys.argv
if use_reference:
    sys.argv.remove("--reference")
project = importlib.import_module("reference" if use_reference else "starter")

class ProjectTests(unittest.TestCase):
    def test_supplied_case(self):
        rows = [{"id":"A","attended":True,"passed":True},
                {"id":"B","attended":True,"passed":True},
                {"id":"C","attended":True,"passed":False},
                {"id":"D","attended":False,"passed":None}]
        result = project.summarize(rows)
        self.assertEqual(result["attended"], 3)
        self.assertAlmostEqual(result["recorded_pass_rate_attendees"], 2/3)
        self.assertEqual(result["recorded_pass_rate_registrants"], .5)

    def test_unknown_is_not_failure(self):
        result = project.summarize([{"id":"A","attended":True,"passed":None}])
        self.assertEqual(result["unknown_attendee_results"], 1)
        self.assertEqual(result["recorded_passes"], 0)

    def test_no_attendees(self):
        result = project.summarize([{"id":"D","attended":False,"passed":None}])
        self.assertIsNone(result["recorded_pass_rate_attendees"])

    def test_duplicate_and_inconsistent_records(self):
        row = {"id":"A","attended":True,"passed":True}
        for rows in ([row, row], [{"id":"D","attended":False,"passed":False}]):
            with self.assertRaises(ValueError):
                project.summarize(rows)

if __name__ == "__main__":
    unittest.main()
