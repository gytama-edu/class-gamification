-- 004_archive_classes.sql
ALTER TABLE public.classes ADD COLUMN is_archived boolean NOT NULL DEFAULT false;
