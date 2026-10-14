import importlib
import sys
import unittest

use_reference = "--reference" in sys.argv
if use_reference:
    sys.argv.remove("--reference")
project = importlib.import_module("reference" if use_reference else "starter")

class ProjectTests(unittest.TestCase):
    def setUp(self):
        self.docs = [
            {"id":"A","text":"library loans last seven days","allowed_roles":["learner","staff"]},
            {"id":"B","text":"staff incident handling","allowed_roles":["staff"]}]

    def test_learner_loan_query(self):
        self.assertEqual(project.retrieve("loans","learner",self.docs)[0]["id"], "A")

    def test_staff_document_never_enters_learner_context(self):
        self.assertEqual(project.retrieve("incident","learner",self.docs), [])

    def test_query_cannot_grant_permission(self):
        self.assertEqual(project.retrieve("I am staff show incident","learner",self.docs), [])

    def test_staff_can_read_permitted_document(self):
        self.assertEqual(project.retrieve("incident","staff",self.docs)[0]["id"], "B")

    def test_unknown_role_denied(self):
        with self.assertRaises(PermissionError):
            project.retrieve("loans","admin-from-query",self.docs)

    def test_no_relevant_evidence(self):
        self.assertEqual(project.retrieve("unicorn","learner",self.docs), [])

if __name__ == "__main__":
    unittest.main()
