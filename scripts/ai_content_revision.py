"""Generate guarded install/rollback SQL for the learner-only content expansion.
No credentials or private teacher answer keys are included.
Usage: python3 scripts/ai_content_revision.py [--rollback] > revision.sql
Run the SQL against the intended MELA project through an authorized DB connection.
"""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--rollback", action="store_true")
args = parser.parse_args()
pack = json.loads((Path(__file__).resolve().parents[1] / "content/ai-course-enrichment-1.1.0.json").read_text())
rows = pack["lessons"]
assert len(rows) == 318 and len({r["lesson_key"] for r in rows}) == 318
assert len({r["course_slug"] for r in rows}) == 53
payload = json.dumps(rows, ensure_ascii=False)
delimiter = "$mela_content_1_1$"
assert delimiter not in payload
print("begin;")
print("set local lock_timeout = '5s';")
print("set local statement_timeout = '60s';")
print("create temporary table mela_revision on commit drop as select * from jsonb_to_recordset("
      + delimiter + payload + delimiter + "::jsonb) as x(lesson_key text, course_slug text, position int, expected_version text, original_md5 text, append_text text);")
if args.rollback:
    operation = """
update public.mela_ai_course_lessons l
set content_text=left(l.content_text,length(l.content_text)-length(r.append_text)),
    content_version=r.expected_version
from mela_revision r
where l.lesson_key=r.lesson_key and l.content_version='1.1.0'
and l.review_status='draft' and l.reviewed_by is null and l.reviewed_at is null
and right(l.content_text,length(r.append_text))=r.append_text
and md5(left(l.content_text,length(l.content_text)-length(r.append_text)))=r.original_md5;
"""
else:
    operation = """
update public.mela_ai_course_lessons l
set content_text=l.content_text || r.append_text, content_version='1.1.0'
from mela_revision r
where l.lesson_key=r.lesson_key and l.content_version=r.expected_version
and l.review_status='draft' and l.reviewed_by is null and l.reviewed_at is null
and md5(l.content_text)=r.original_md5;
"""
print("do $guard$ declare affected integer; begin")
print(operation)
print("get diagnostics affected = row_count;")
print("if affected <> 318 then raise exception 'Expected 318 unchanged unreviewed lessons; got %. No changes committed.', affected; end if;")
print("end $guard$;")
print("select content_version,review_status,count(*) from public.mela_ai_course_lessons where lesson_key in (select lesson_key from mela_revision) group by content_version,review_status;")
print("commit;")
