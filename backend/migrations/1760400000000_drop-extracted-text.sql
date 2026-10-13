-- Up Migration
-- Data minimization: the CV text is only needed to build the profile, so it is no longer
-- stored (like the PDF, deleted after processing). Dropping the column also deletes the text
-- already stored.

ALTER TABLE cvs DROP COLUMN IF EXISTS extracted_text;

-- Down Migration
ALTER TABLE cvs ADD COLUMN extracted_text TEXT;
