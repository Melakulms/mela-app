# Event draft validation

Teaching draft — educator review pending.

Validate a mock AI extractor's response and keep missing dates in review.

## Task and expected behavior

A missing date produces needs_review. 2026-02-30 raises ValueError. A valid event is ready_for_review, never automatically published.

The test_project.py file supplies synthetic input fixtures, required return keys, error cases and expected results. Read each test before coding. Implement the API in starter.py without changing the supplied tests. Add at least one new edge-case test of your own.

## Run

Requires Python 3.10 or later with its standard library; no packages, API keys or paid services. From this project folder:

```sh
python3 test_project.py
python3 test_project.py --reference
```

The starter deliberately raises NotImplementedError until you implement it. First predict the expected results, then implement and test. The second command runs the worked example in reference.py; use it after your attempt to compare approaches. These are public practice solutions, not assessment answer keys.

## Submit

Submit your completed starter.py, test output, one added edge case, and a short explanation of one mistake you corrected. Record actual active minutes in the course workbook. A passing supplied test suite checks these examples only; it does not prove production readiness.

## Optional extension

Add a separate reviewer-authorized publication function in a mock application. Explain why hiding a publish button is not server-side authorization.

## Time and access

Use this as the runnable form of the course practice activity, within its existing practice budget. Setup, prerequisite Python study and this optional extension are additional and variable; do not count them as completed training by default. If using a phone without a Python runner, read the files and trace the supplied example in your workbook. Mark it as a manual trace, not a successful code execution.

## Limits

All inputs are fictional. This exercise makes no model calls and sends no messages. It illustrates one engineering concept, not a full AI product. In-memory state does not survive restarts, keyword retrieval is not semantic search, and role arguments are not real authentication. Use the course review checklist and explain the limitations relevant to your project.
