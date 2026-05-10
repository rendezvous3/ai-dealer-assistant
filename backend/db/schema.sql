CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  vin TEXT,
  condition TEXT NOT NULL,
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,
  body_type TEXT NOT NULL,
  drive_type TEXT,
  fuel_type TEXT,
  transmission TEXT,
  engine TEXT,
  horsepower INTEGER,
  mpg_city INTEGER,
  mpg_highway INTEGER,
  seats INTEGER,
  doors INTEGER,
  mileage INTEGER,
  price REAL NOT NULL,
  msrp REAL,
  exterior_color TEXT,
  interior_color TEXT,
  description TEXT,
  key_features TEXT,
  use_case_tags TEXT,
  priority_tags TEXT,
  image_url TEXT,
  dealer_name TEXT,
  dealer_zip TEXT,
  source_name TEXT,
  source_url TEXT,
  in_stock INTEGER DEFAULT 1,
  featured INTEGER DEFAULT 0,
  last_updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_condition ON vehicles(condition);
CREATE INDEX IF NOT EXISTS idx_body_type ON vehicles(body_type);
CREATE INDEX IF NOT EXISTS idx_drive_type ON vehicles(drive_type);
CREATE INDEX IF NOT EXISTS idx_fuel_type ON vehicles(fuel_type);
CREATE INDEX IF NOT EXISTS idx_price ON vehicles(price);
CREATE INDEX IF NOT EXISTS idx_make ON vehicles(make);
CREATE INDEX IF NOT EXISTS idx_year ON vehicles(year);
CREATE INDEX IF NOT EXISTS idx_in_stock ON vehicles(in_stock);
CREATE INDEX IF NOT EXISTS idx_mileage ON vehicles(mileage);
