"""Generate transactional install SQL. Review and run using authorized MELA database access.
Usage: python3 scripts/ai_course_support.py > /tmp/mela-course-support.sql
The import refuses changed or reviewed lessons and changed catalogue durations.
"""
import json
from pathlib import Path
p=json.loads((Path(__file__).resolve().parents[1]/'content/ai-course-support-1.2.0.json').read_text())
assert len(p['courses'])==53 and len(p['lesson_updates'])==318
def literal(obj):
    value=json.dumps(obj,ensure_ascii=False)
    assert '$support$' not in value
    return '$support$'+value+'$support$::jsonb'
print("begin; set local lock_timeout='5s'; set local statement_timeout='60s';")
print("create temporary table lesson_revision on commit drop as select * from jsonb_to_recordset("+literal(p['lesson_updates'])+") as x(lesson_key text,course_id uuid,original_md5 text,old_minutes integer,new_minutes integer,append_text text);")
print("create temporary table course_revision on commit drop as select * from jsonb_to_recordset("+literal(p['courses'])+") as x(id uuid,catalog_minutes integer,estimated_minutes integer);")
print("""
do $guard$ declare affected integer; begin
update public.mela_ai_course_lessons l
set content_text=l.content_text || r.append_text,duration_minutes=r.new_minutes,content_version='1.2.0'
from lesson_revision r
where l.lesson_key=r.lesson_key and l.course_id=r.course_id and l.content_version='1.1.0'
and md5(l.content_text)=r.original_md5 and l.duration_minutes=r.old_minutes
and l.review_status='draft' and l.reviewed_by is null and l.reviewed_at is null;
get diagnostics affected=row_count;
if affected<>318 then raise exception 'Expected 318 unchanged unreviewed lessons; got %',affected; end if;
update public.courses c set duration_minutes=r.estimated_minutes from course_revision r
where c.id=r.id and c.duration_minutes is not distinct from r.catalog_minutes;
get diagnostics affected=row_count;
if affected<>53 then raise exception 'Expected 53 unchanged course durations; got %',affected; end if;
end $guard$;
commit;
""")
