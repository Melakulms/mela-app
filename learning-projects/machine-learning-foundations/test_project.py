import importlib
import sys
import unittest

use_reference = "--reference" in sys.argv
if use_reference:
    sys.argv.remove("--reference")
project = importlib.import_module("reference" if use_reference else "starter")

class ProjectTests(unittest.TestCase):
    def test_known_matrix(self):
        result = project.metrics(8, 2, 4, 6)
        self.assertAlmostEqual(result["accuracy"], .7)
        self.assertAlmostEqual(result["precision"], .8)
        self.assertAlmostEqual(result["recall"], 2/3)

    def test_no_predicted_positives(self):
        result = project.metrics(0, 0, 4, 6)
        self.assertIsNone(result["precision"])
        self.assertEqual(result["recall"], 0)

    def test_empty_matrix(self):
        self.assertEqual(project.metrics(0, 0, 0, 0),
                         {"accuracy": None, "precision": None, "recall": None})

    def test_invalid_counts(self):
        for values in ((-1, 0, 0, 0), (True, 0, 0, 0), (1.5, 0, 0, 0)):
            with self.subTest(values=values), self.assertRaises(ValueError):
                project.metrics(*values)

if __name__ == "__main__":
    unittest.main()
