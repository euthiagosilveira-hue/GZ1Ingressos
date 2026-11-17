-- =============================================================================
-- GZ1 Ingresso - Novo perfil de usuario: ACOMPANHAMENTO
-- Migration: perfil_acompanhamento
--
-- Isolada em arquivo proprio porque ALTER TYPE ... ADD VALUE nao pode ser
-- usado na mesma transacao que o cria. Rode ESTE arquivo primeiro e depois
-- 20261117000100_acompanhamento_eventos.sql.
--
-- O ACOMPANHAMENTO nao tem acesso a nenhuma funcao existente (todas exigem
-- ADMINISTRADOR, PORTARIA ou PRODUTOR). Ele so usa as funcoes
-- *_acompanhamento criadas no arquivo seguinte (somente leitura).
-- =============================================================================

alter type public.perfil_usuario add value if not exists 'ACOMPANHAMENTO';
