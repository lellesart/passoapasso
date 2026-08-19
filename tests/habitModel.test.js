import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleDailyHabitCompletion } from '../src/services/ai/habitModel.js';

test('toggleDailyHabitCompletion marca e desmarca um hábito no mesmo dia', () => {
  const dateKey = '2026-08-19';
  const marked = toggleDailyHabitCompletion(
    { lastDate: dateKey, completed: { h_treino: false } },
    'h_treino',
    dateKey
  );

  assert.equal(marked.completed.h_treino, true);

  const unmarked = toggleDailyHabitCompletion(marked, 'h_treino', dateKey);
  assert.equal(unmarked.completed.h_treino, false);
});

test('toggleDailyHabitCompletion reinicia conclusões de um dia anterior', () => {
  const nextState = toggleDailyHabitCompletion(
    { lastDate: '2026-08-18', completed: { h_treino: true } },
    'h_estudo',
    '2026-08-19'
  );

  assert.deepEqual(nextState, {
    lastDate: '2026-08-19',
    completed: { h_estudo: true },
  });
});
