-- STAGING ONLY: tungqfmypuwzeyrtaseh. Do not run against production.
-- Missing feature rows made tested Practice and Academy buttons disabled.
insert into public.platform_feature_flags(feature_key,label,description,enabled)
values ('practice','Practice','Adult staging practice with explicitly labeled test content',true),
       ('academy','Skill Academy','Free staging course enrollment and lesson progress',true)
on conflict(feature_key) do update set enabled=excluded.enabled;
