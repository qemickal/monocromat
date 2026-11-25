-- Mono Cromat: estructura inicial propuesta. Aplicar únicamente en una base nueva
-- o después de revisar y probar una migración; no ejecutado automáticamente.
BEGIN;
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('prospecto','cliente')),
  name TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  client_name TEXT NOT NULL,
  project TEXT NOT NULL,
  technique TEXT NOT NULL DEFAULT '',
  conditions TEXT NOT NULL DEFAULT '',
  include_vat BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'borrador',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS quote_options (
  id UUID PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK(position > 0),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents BIGINT NOT NULL CHECK(price_cents >= 0),
  UNIQUE (quote_id,position),
  UNIQUE (quote_id,id)
);
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  quote_id UUID REFERENCES quotes(id),
  selected_option_id UUID,
  client_id UUID REFERENCES clients(id),
  client_name TEXT NOT NULL,
  project TEXT NOT NULL,
  option_snapshot TEXT NOT NULL,
  subtotal_cents BIGINT NOT NULL CHECK(subtotal_cents >= 0),
  vat_cents BIGINT NOT NULL DEFAULT 0 CHECK(vat_cents >= 0),
  total_cents BIGINT NOT NULL CHECK(total_cents = subtotal_cents + vat_cents),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (quote_id,selected_option_id) REFERENCES quote_options(quote_id,id)
);
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL CHECK(amount_cents > 0),
  paid_on DATE NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_order_idx ON payments(order_id);
CREATE TABLE IF NOT EXISTS production_orders (
  order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  materials TEXT NOT NULL DEFAULT '',
  estimated_cost_cents BIGINT CHECK(estimated_cost_cents >= 0),
  estimated_time TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS quality_checks (
  order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  specifications BOOLEAN NOT NULL DEFAULT FALSE,
  finishes BOOLEAN NOT NULL DEFAULT FALSE,
  conforming BOOLEAN NOT NULL DEFAULT FALSE,
  reviewer_id UUID REFERENCES users(id),
  reviewed_on DATE,
  notes TEXT NOT NULL DEFAULT '',
  packaging_approved BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK(NOT packaging_approved OR (specifications AND finishes AND conforming AND reviewer_id IS NOT NULL AND reviewed_on IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS deliveries (
  order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  scheduled_on DATE NOT NULL,
  method TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  recipient TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deliveries_date_idx ON deliveries(scheduled_on);
COMMIT;
-- Límite por cuenta para reducir intentos de acceso; debe complementarse con
-- mitigación en el borde por IP y monitoreo antes de publicar.
CREATE TABLE IF NOT EXISTS login_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
