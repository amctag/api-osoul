CREATE TABLE IF NOT EXISTS support (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  email TEXT NOT NULL DEFAULT 'osoulappdeveloper@gmail.com',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO support (id, email)
VALUES (1, 'osoulappdeveloper@gmail.com')
ON CONFLICT (id) DO NOTHING;
