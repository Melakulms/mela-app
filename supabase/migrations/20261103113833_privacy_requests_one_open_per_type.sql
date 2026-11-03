-- Guarantee one OPEN request per person and right, including concurrent submissions.
-- Closed historical requests do not block a later request.
-- Tested on staging with duplicate and historical-row assertions inside ROLLBACK.
CREATE UNIQUE INDEX IF NOT EXISTS data_subject_requests_one_open_per_type_uidx
ON public.data_subject_requests (user_id, request_type)
WHERE status IN ('pending', 'in_review');
