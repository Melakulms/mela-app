-- Keep public opportunity listings consistent with their deadlines.
update public.opportunities
set status='closed', updated_at=now()
where status='open' and deadline < current_date;
