-- Stage/production parity for the existing authenticated, SECURITY INVOKER intake RPC.
-- No anonymous execution. Authorization remains anchored to auth.uid() + table RLS.
REVOKE ALL ON FUNCTION public.request_my_data_subject_action(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_my_data_subject_action(text,text) TO authenticated;
