-- Up Migration
-- Schema from docs/07-DATABASE.md.

CREATE TABLE cvs (
  id UUID PRIMARY KEY,
  original_filename VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  extracted_text TEXT,
  processing_status VARCHAR(20) NOT NULL
    CHECK (processing_status IN ('UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE candidate_profiles (
  id UUID PRIMARY KEY,
  cv_id UUID NOT NULL UNIQUE REFERENCES cvs(id) ON DELETE CASCADE,
  summary TEXT,
  seniority VARCHAR(20)
    CHECK (seniority IN ('INTERN', 'JUNIOR', 'SEMI_SENIOR', 'SENIOR', 'LEAD', 'MANAGER', 'UNKNOWN')),
  total_experience_years NUMERIC(5, 2) CHECK (total_experience_years >= 0),
  location VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE experiences (
  id UUID PRIMARY KEY,
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  company VARCHAR(255),
  position VARCHAR(255),
  description TEXT,
  start_date DATE,
  end_date DATE,
  years NUMERIC(5, 2) CHECK (years >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE education (
  id UUID PRIMARY KEY,
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  institution VARCHAR(255),
  degree VARCHAR(255),
  field VARCHAR(255),
  level VARCHAR(20)
    CHECK (level IN ('SECONDARY', 'TERTIARY', 'UNIVERSITY', 'POSTGRADUATE', 'UNKNOWN')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE languages (
  id UUID PRIMARY KEY,
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  level VARCHAR(10) CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE skills (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  normalized_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE candidate_skills (
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  PRIMARY KEY (candidate_profile_id, skill_id)
);

CREATE TABLE job_offers (
  id UUID PRIMARY KEY,
  external_id VARCHAR(255),
  source VARCHAR(50) NOT NULL,
  source_url TEXT NOT NULL,
  title VARCHAR(500) NOT NULL,
  company VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  modality VARCHAR(20) CHECK (modality IN ('REMOTE', 'HYBRID', 'ONSITE', 'UNKNOWN')),
  description TEXT NOT NULL DEFAULT '',
  requirements TEXT NOT NULL DEFAULT '',
  seniority VARCHAR(20)
    CHECK (seniority IN ('INTERN', 'JUNIOR', 'SEMI_SENIOR', 'SENIOR', 'LEAD', 'MANAGER', 'UNKNOWN')),
  experience_years_min NUMERIC(5, 2) CHECK (experience_years_min >= 0),
  education_requirements JSONB,
  language_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE job_skills (
  job_offer_id UUID NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  is_required BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (job_offer_id, skill_id)
);

CREATE TABLE match_results (
  id UUID PRIMARY KEY,
  cv_id UUID NOT NULL REFERENCES cvs(id) ON DELETE CASCADE,
  job_offer_id UUID NOT NULL REFERENCES job_offers(id) ON DELETE CASCADE,
  score NUMERIC(5, 2) NOT NULL CHECK (score >= 0 AND score <= 100),
  level VARCHAR(10) NOT NULL CHECK (level IN ('LOW', 'MEDIUM', 'HIGH')),
  criteria_json JSONB NOT NULL,
  reasons_json JSONB NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (cv_id, job_offer_id)
);

CREATE UNIQUE INDEX job_offers_source_external_id_idx
  ON job_offers (source, external_id) WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX job_offers_source_url_idx ON job_offers (source_url);
CREATE INDEX job_offers_is_active_idx ON job_offers (is_active);
CREATE INDEX job_offers_last_seen_at_idx ON job_offers (last_seen_at);
CREATE INDEX match_results_cv_score_idx ON match_results (cv_id, score DESC);
CREATE INDEX candidate_skills_skill_idx ON candidate_skills (skill_id);
CREATE INDEX job_skills_skill_idx ON job_skills (skill_id);

-- Down Migration
DROP TABLE IF EXISTS match_results;
DROP TABLE IF EXISTS job_skills;
DROP TABLE IF EXISTS job_offers;
DROP TABLE IF EXISTS candidate_skills;
DROP TABLE IF EXISTS skills;
DROP TABLE IF EXISTS languages;
DROP TABLE IF EXISTS education;
DROP TABLE IF EXISTS experiences;
DROP TABLE IF EXISTS candidate_profiles;
DROP TABLE IF EXISTS cvs;
