-- Prevent one user from creating multiple tournament teams in the same tournament.
create unique index if not exists arena_tournament_teams_one_team_per_captain_uidx
on public.arena_tournament_teams(tournament_id,captain_id)
where captain_id is not null;
