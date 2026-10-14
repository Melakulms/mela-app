import importlib
import sys
import unittest

use_reference = "--reference" in sys.argv
if use_reference:
    sys.argv.remove("--reference")
project = importlib.import_module("reference" if use_reference else "starter")

class ProjectTests(unittest.TestCase):
    def test_known_mean(self):
        self.assertEqual(project.mean_score([60, 75, 90]), 75.0)

    def test_zero_is_valid(self):
        self.assertEqual(project.mean_score([0]), 0.0)

    def test_rejects_bad_inputs(self):
        for value in ([], None, [True], ["75"], [101], [-1], [float("nan")], [float("inf")]):
            with self.subTest(value=value), self.assertRaises(ValueError):
                project.mean_score(value)

    def test_input_preserved(self):
        scores = [20, 80]
        project.mean_score(scores)
        self.assertEqual(scores, [20, 80])

if __name__ == "__main__":
    unittest.main()
