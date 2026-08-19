import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_AUDIT_MAX_ENTRIES,
  appendAuditEntry,
  createAuditEntry,
  sanitizeAuditArguments,
} from '../src/services/ai/actionAudit.js';

test('audit stores validated fields without prompts, tokens or full note content', () => {
  const entry = createAuditEntry({
    toolName: 'editar_nota',
    arguments: {
      id: 'n1',
      titulo: 'Diário',
      conteudo: 'Conteúdo privado muito detalhado',
      itens: ['Café', 'Granola'],
      prompt: 'prompt completo não deve entrar',
      accessToken: 'segredo',
    },
    confirmation: 'confirmed',
    result: 'success',
    resultMessage: 'Nota atualizada.',
    collection: 'notes',
  }, new Date('2026-08-15T12:00:00Z'));

  assert.equal(entry.toolName, 'editar_nota');
  assert.deepEqual(entry.arguments.conteudo, { omitido: true, caracteres: 32 });
  assert.deepEqual(entry.arguments.itens, { omitido: true, quantidade: 2 });
  assert.equal('prompt' in entry.arguments, false);
  assert.equal('accessToken' in entry.arguments, false);
  assert.doesNotMatch(JSON.stringify(entry), /segredo|prompt completo|Conteúdo privado/);
});

test('audit arguments are whitelisted per tool', () => {
  assert.deepEqual(sanitizeAuditArguments('excluir_tarefa', {
    id: 't1', titulo: 'não registrar', token: 'não registrar',
  }), { id: 't1' });
  assert.deepEqual(sanitizeAuditArguments('ferramenta_inexistente', { id: 'x' }), {});
});

test('audit retention removes old entries and caps the history', () => {
  const now = new Date('2026-08-15T12:00:00Z');
  const recentEntries = Array.from({ length: AI_AUDIT_MAX_ENTRIES + 10 }, (_, index) => ({
    id: `recent-${index}`,
    timestamp: new Date(now.getTime() - index * 1000).toISOString(),
  }));
  const expired = { id: 'expired', timestamp: '2026-06-01T12:00:00.000Z' };
  const newest = createAuditEntry({
    toolName: 'excluir_habito',
    arguments: { id: 'h1' },
    confirmation: 'confirmed',
    result: 'success',
  }, now);
  const retained = appendAuditEntry([...recentEntries, expired], newest, { now });

  assert.equal(retained.length, AI_AUDIT_MAX_ENTRIES);
  assert.equal(retained[0].id, newest.id);
  assert.equal(retained.some(entry => entry.id === 'expired'), false);
});
