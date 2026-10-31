-- NewRelicModal guarda los adjuntos bajo el id de la reliquia ANTES de que
-- esa reliquia exista (se crea al pulsar "Guardar"). sqlx abre cada conexión
-- con PRAGMA foreign_keys=ON, así que el REFERENCES relics(id) rechazaba
-- todos esos INSERT. Se reconstruye la tabla sin esa referencia; el borrado
-- en cascada ya lo hace relicStorage.deleteRelic de forma explícita.
--
-- Es seguro reconstruir esta tabla: ninguna otra la referencia, así que el
-- DROP TABLE no dispara ningún borrado en cascada.

CREATE TABLE attachments_new (
  id            TEXT PRIMARY KEY,
  relic_id      TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  original_name TEXT NOT NULL,
  extension     TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size          INTEGER NOT NULL,
  file_path     TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

INSERT INTO attachments_new (
  id, relic_id, user_id, original_name, extension, mime_type, size, file_path, created_at
)
SELECT
  id, relic_id, user_id, original_name, extension, mime_type, size, file_path, created_at
FROM attachments;

DROP TABLE attachments;
ALTER TABLE attachments_new RENAME TO attachments;

CREATE INDEX IF NOT EXISTS idx_attachments_relic_id ON attachments(relic_id);
CREATE INDEX IF NOT EXISTS idx_attachments_user_id  ON attachments(user_id);
