-- ================================================================
--  EJECUTAR ESTO EN EL SQL EDITOR DE SUPABASE
--  (una sola vez, al configurar el proyecto)
-- ================================================================

-- Tabla principal de movimientos
CREATE TABLE movimientos (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  fecha          DATE NOT NULL,
  detalle        TEXT NOT NULL,
  tipo           TEXT NOT NULL CHECK (tipo IN (
                   'Ingreso operativo',
                   'Egreso operativo',
                   'Inversión / Préstamo',
                   'Tarjeta de crédito',
                   'Banco / Transferencia'
                 )),
  empresa        TEXT,
  cuit           TEXT,
  monto          NUMERIC(18,2) NOT NULL DEFAULT 0,
  monto_neto     NUMERIC(18,2),
  tipo_cambio    NUMERIC(18,4),
  usd            NUMERIC(18,2),
  clasificacion  TEXT,
  documento      TEXT,
  observaciones  TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_movimientos_user_id ON movimientos(user_id);
CREATE INDEX idx_movimientos_fecha   ON movimientos(fecha DESC);

-- Row Level Security: cada usuario solo ve sus propios datos
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_solo_sus_datos" ON movimientos
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
