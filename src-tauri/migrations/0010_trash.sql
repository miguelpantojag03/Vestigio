-- Papelera: una reliquia eliminada queda marcada y se puede restaurar; solo
-- se borra de verdad desde la papelera. NULL = no está en la papelera.
-- Aditiva: ninguna fila existente cambia. La vista relics_with_counts usa
-- r.*, así que la columna nueva aparece en ella sin recrearla.
ALTER TABLE relics ADD COLUMN deleted_at TEXT;
