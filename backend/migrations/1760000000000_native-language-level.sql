-- Up Migration
-- "Nativo" is a language level of its own, above C2.

ALTER TABLE languages DROP CONSTRAINT languages_level_check;
ALTER TABLE languages
  ADD CONSTRAINT languages_level_check
  CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'NATIVE'));

-- Down Migration
UPDATE languages SET level = 'C2' WHERE level = 'NATIVE';
ALTER TABLE languages DROP CONSTRAINT languages_level_check;
ALTER TABLE languages
  ADD CONSTRAINT languages_level_check
  CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));
