# Verified assessment reliability

Save & exit now waits for queued autosaves and writes the latest answers before leaving. Failed saves retain the session and responses on screen. Autosaves run in order; submission waits for them before saving the final response snapshot. Backend error messages are displayed, answered progress is shown, and result text no longer promises credential issuance from a passing score alone. Expiry text defers to the server (which has a grace interval).

## Validation

- Six assessment UI tests pass, including slow saves, failed exit and rapid answer changes followed by submission, and lost submission response recovery.
- Production build passes.
- Full suite: 70 files, 355 tests pass.
- Production read-only inspection: eight published assessments, each with ten active English source questions and ten matching private answer-key rows. Each has English certification recorded. These counts do not independently certify question quality.
- Production submission RPC checks authentication and attempt ownership and locks the attempt. Grading occurs in a database trigger. Proctored results require review clearance before skill issuance. Audience guard blocks school stages through Grade 10.
- Staging has one published assessment and three auth users. No authenticated learner or reviewer credentials were provided for this session.

## Remaining release verification

This change does not establish full end-to-end completion. Run an authorized staging learner session through start, save, resume, submit, reviewer clearance and Career Passport issuance. Verify reviewer MFA and denied cross-user access using actual sessions; do not infer these from unit mocks. Exercise Android navigation and camera denial on-device.

Submission errors now reconcile finalized results against attempt history; verify this against a real interrupted network session. Verify concurrent attempt creation, certified language selection, eligibility guidance, and the proctor service's review policy before declaring the section production-ready.

No production database changes were made by this work.
