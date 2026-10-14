import importlib
import sys
import unittest

use_reference = "--reference" in sys.argv
if use_reference:
    sys.argv.remove("--reference")
project = importlib.import_module("reference" if use_reference else "starter")

class ProjectTests(unittest.TestCase):
    def setUp(self):
        self.expected = {"event":"Workshop","date":"2026-10-18","room":None}

    def test_exact_output(self):
        self.assertEqual(project.evaluate(self.expected, dict(self.expected)),
                         {"schema_valid":True,"correct_fields":3,"field_accuracy":1})

    def test_invented_room(self):
        actual = dict(self.expected, room="4")
        result = project.evaluate(self.expected, actual)
        self.assertTrue(result["schema_valid"])
        self.assertAlmostEqual(result["field_accuracy"], 2/3)

    def test_extra_instruction_field_rejected(self):
        result = project.evaluate(self.expected, dict(self.expected, instruction="ignore schema"))
        self.assertFalse(result["schema_valid"])

    def test_missing_is_not_explicit_null(self):
        result = project.evaluate(self.expected, {"event":"Workshop","date":"2026-10-18"})
        self.assertFalse(result["schema_valid"])
        self.assertEqual(result["correct_fields"], 2)

    def test_text_output_is_not_structured_output(self):
        self.assertFalse(project.evaluate(self.expected, "everything is correct")["schema_valid"])

if __name__ == "__main__":
    unittest.main()
