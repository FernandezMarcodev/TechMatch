-- Up Migration
-- Personal or academic projects listed in the CV ("Proyectos").

CREATE TABLE projects (
  id UUID PRIMARY KEY,
  candidate_profile_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  name VARCHAR(255),
  description TEXT,
  start_date DATE,
  end_date DATE,
  position SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_profile ON projects (candidate_profile_id);

-- Down Migration
DROP TABLE IF EXISTS projects;
