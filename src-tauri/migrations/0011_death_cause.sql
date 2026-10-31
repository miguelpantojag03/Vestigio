-- Causa de muerte: por qué se descartó una idea, en vez de que la IA tenga
-- que adivinarlo. death_cause es una clave fija (ver constants/deathCauses.js)
-- para poder filtrar y encontrar patrones; death_cause_detail es texto libre.
-- Nullable/aditiva: las reliquias existentes quedan sin causa.
ALTER TABLE relics ADD COLUMN death_cause TEXT;
ALTER TABLE relics ADD COLUMN death_cause_detail TEXT;
