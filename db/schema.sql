-- RuralCare Connect — PostgreSQL Schema (Supabase)

CREATE TABLE IF NOT EXISTS hospitals (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK(type IN ('District Hospital','CHC','PHC','Other')),
  block      TEXT NOT NULL,
  district   TEXT NOT NULL DEFAULT 'Kolar',
  lat        REAL,
  lng        REAL,
  phone      TEXT,
  beds_total INTEGER DEFAULT 0,
  icu_total  INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  login_id      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK(role IN ('patient','hospital','govt')),
  name          TEXT NOT NULL,
  hospital_id   INTEGER REFERENCES hospitals(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hospital_resources (
  id               SERIAL PRIMARY KEY,
  hospital_id      INTEGER NOT NULL UNIQUE REFERENCES hospitals(id),
  beds_free        INTEGER DEFAULT 0,
  icu_free         INTEGER DEFAULT 0,
  o2_cylinders     INTEGER DEFAULT 0,
  doctors_on_duty  INTEGER DEFAULT 0,
  ventilators_free INTEGER DEFAULT 0,
  blood_bank_units INTEGER DEFAULT 0,
  public_alert_msg TEXT,
  updated_by       INTEGER REFERENCES users(id),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ward_status (
  id             SERIAL PRIMARY KEY,
  hospital_id    INTEGER NOT NULL REFERENCES hospitals(id),
  ward_name      TEXT NOT NULL,
  beds_total     INTEGER DEFAULT 0,
  beds_occupied  INTEGER DEFAULT 0,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hospital_id, ward_name)
);

CREATE TABLE IF NOT EXISTS resource_thresholds (
  id              SERIAL PRIMARY KEY,
  hospital_id     INTEGER NOT NULL REFERENCES hospitals(id),
  resource_key    TEXT NOT NULL,
  threshold_value INTEGER NOT NULL,
  UNIQUE(hospital_id, resource_key)
);

CREATE TABLE IF NOT EXISTS patients (
  id                     SERIAL PRIMARY KEY,
  patient_ref            TEXT NOT NULL UNIQUE,
  abha_id                TEXT,
  name                   TEXT NOT NULL,
  mobile                 TEXT NOT NULL,
  age                    INTEGER,
  gender                 TEXT CHECK(gender IN ('M','F','O')),
  blood_group            TEXT,
  village                TEXT,
  aadhaar_masked         TEXT,
  registered_hospital_id INTEGER REFERENCES hospitals(id),
  linked_user_id         INTEGER REFERENCES users(id),
  status                 TEXT DEFAULT 'active' CHECK(status IN ('active','discharged')),
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_conditions (
  id             SERIAL PRIMARY KEY,
  patient_id     INTEGER NOT NULL REFERENCES patients(id),
  condition_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patient_medications (
  id            SERIAL PRIMARY KEY,
  patient_id    INTEGER NOT NULL REFERENCES patients(id),
  medicine_name TEXT NOT NULL,
  dose          TEXT,
  prescribed_by TEXT,
  since_date    TEXT,
  active        INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS patient_visits (
  id                  SERIAL PRIMARY KEY,
  patient_id          INTEGER NOT NULL REFERENCES patients(id),
  visit_date          TEXT NOT NULL,
  location            TEXT,
  doctor              TEXT,
  notes               TEXT,
  prescription_change TEXT,
  created_by          INTEGER REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medicines (
  id                  SERIAL PRIMARY KEY,
  hospital_id         INTEGER NOT NULL REFERENCES hospitals(id),
  name                TEXT NOT NULL,
  generic_name        TEXT,
  strength            TEXT,
  quantity_available  INTEGER DEFAULT 0,
  unit_price_govt     REAL,
  unit_price_private  REAL,
  source              TEXT DEFAULT 'govt' CHECK(source IN ('govt','private')),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medicine_reservations (
  id           SERIAL PRIMARY KEY,
  medicine_id  INTEGER NOT NULL REFERENCES medicines(id),
  patient_id   INTEGER NOT NULL REFERENCES patients(id),
  quantity     INTEGER DEFAULT 1,
  status       TEXT DEFAULT 'pending' CHECK(status IN ('pending','ready','collected','expired')),
  reserved_at  TIMESTAMPTZ DEFAULT NOW(),
  collected_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS vendors (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  type             TEXT,
  rating           REAL DEFAULT 0,
  avg_delivery_days INTEGER,
  contact          TEXT,
  verified         INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS shortage_requests (
  id              SERIAL PRIMARY KEY,
  ref_number      TEXT NOT NULL UNIQUE,
  hospital_id     INTEGER NOT NULL REFERENCES hospitals(id),
  item_name       TEXT NOT NULL,
  quantity_needed INTEGER NOT NULL,
  current_stock   INTEGER DEFAULT 0,
  priority        TEXT DEFAULT 'normal' CHECK(priority IN ('critical','high','normal')),
  justification   TEXT,
  bill_file_path  TEXT,
  vendor_id       INTEGER REFERENCES vendors(id),
  status          TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','dispatched','delivered')),
  raised_by       INTEGER REFERENCES users(id),
  approved_by     INTEGER REFERENCES users(id),
  raised_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS emergency_calls (
  id                  SERIAL PRIMARY KEY,
  patient_id          INTEGER REFERENCES patients(id),
  location_text       TEXT,
  lat                 REAL,
  lng                 REAL,
  emergency_type      TEXT,
  assigned_hospital_id INTEGER REFERENCES hospitals(id),
  status              TEXT DEFAULT 'triggered' CHECK(status IN ('triggered','dispatched','resolved')),
  triggered_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  user_name   TEXT NOT NULL DEFAULT 'System',
  action_type TEXT NOT NULL CHECK(action_type IN ('update','shortage','admin','submit')),
  description TEXT NOT NULL,
  entity_type TEXT,
  entity_id   INTEGER,
  timestamp   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bed_reservations (
  id               SERIAL PRIMARY KEY,
  patient_id       INTEGER NOT NULL REFERENCES patients(id),
  hospital_id      INTEGER NOT NULL REFERENCES hospitals(id),
  ward_preference  TEXT,
  reason           TEXT,
  status           TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled')),
  reserved_at      TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at     TIMESTAMPTZ
);
