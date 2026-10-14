import importlib
import sys
import unittest

use_reference = "--reference" in sys.argv
if use_reference:
    sys.argv.remove("--reference")
project = importlib.import_module("reference" if use_reference else "starter")

class ProjectTests(unittest.TestCase):
    def records(self):
        return [{"month":m,"demand":10 if m<=8 else 12 if m<=10 else 14} for m in range(1,13)]

    def test_known_baseline(self):
        result = project.baseline(self.records())
        self.assertEqual(result, {"prediction":10,"validation_mae":2,"test_mae":4})

    def test_future_does_not_change_fitted_baseline(self):
        rows = self.records()
        rows[11]["demand"] = 1000
        self.assertEqual(project.baseline(rows)["prediction"], 10)

    def test_order_of_input_does_not_change_split(self):
        self.assertEqual(project.baseline(list(reversed(self.records()))), project.baseline(self.records()))

    def test_duplicate_month_rejected(self):
        rows = self.records()
        rows[-1]["month"] = 11
        with self.assertRaises(ValueError):
            project.baseline(rows)

    def test_missing_value_rejected(self):
        rows = self.records()
        rows[0]["demand"] = None
        with self.assertRaises(ValueError):
            project.baseline(rows)

if __name__ == "__main__":
    unittest.main()
