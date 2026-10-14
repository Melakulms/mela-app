import importlib
import sys
import unittest

use_reference = "--reference" in sys.argv
if use_reference:
    sys.argv.remove("--reference")
project = importlib.import_module("reference" if use_reference else "starter")

class ProjectTests(unittest.TestCase):
    def test_join_multiplication(self):
        result = project.revenue_report([("o1","C1",100),("o2","C1",200)], [("a","C1"),("b","C1")])
        self.assertEqual(result["naive_join_total"], 600)
        self.assertEqual(result["correct_total"], 300)

    def test_equal_amounts_are_distinct_orders(self):
        result = project.revenue_report([("o1","C1",100),("o2","C1",100)], [("a","C1"),("b","C1")])
        self.assertEqual(result["correct_total"], 200)

    def test_missing_contact_does_not_erase_revenue(self):
        result = project.revenue_report([("o1","C1",100)], [])
        self.assertEqual(result["correct_total"], 100)
        self.assertEqual(result["naive_join_total"], 0)

    def test_text_is_data(self):
        result = project.revenue_report([("o1","C1'; DROP TABLE orders;--",100)], [])
        self.assertEqual(result["correct_total"], 100)

if __name__ == "__main__":
    unittest.main()
