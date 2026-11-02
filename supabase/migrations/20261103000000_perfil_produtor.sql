-- =============================================================================
-- GZ1 Ingresso - Novo perfil de usuario: PRODUTOR
-- Migration: perfil_produtor
--
-- Isolada em arquivo proprio porque ALTER TYPE ... ADD VALUE nao pode ser
-- usado na mesma transacao que o cria. Rode ESTE arquivo primeiro e depois
-- 20261103000100_acesso_produtor.sql.
--
-- O PRODUTOR nao tem acesso a nenhuma funcao existente (todas exigem
-- ADMINISTRADOR ou PORTARIA). Ele so usa as funcoes *_produtor criadas no
-- arquivo seguinte, que devolvem somente os eventos ligados a ele.
-- =============================================================================

alter type public.perfil_usuario add value if not exists 'PRODUTOR';
