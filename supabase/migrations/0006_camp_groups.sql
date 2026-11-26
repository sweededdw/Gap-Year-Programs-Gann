-- 0006: students can create a group for a camp (summer or day camp), alongside chapters, school clubs and
-- friend groups. Run after 0005 (safe to run again). Camp groups follow every 0004 rule: admin review,
-- the word filter, reports and the 3-groups-per-student limit.

alter table public.student_groups drop constraint if exists student_groups_kind_check;
alter table public.student_groups add constraint student_groups_kind_check
  check (kind in ('chapter', 'school', 'camp', 'friends', 'other'));
