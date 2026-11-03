import test from 'node:test';
import assert from 'node:assert/strict';
import { ORDEN, mensajeDelDia } from '../web/src/mensajes.js';

test('salen los 42 mensajes, cada uno una vez', () => {
  assert.equal(ORDEN.length, 42);
  assert.equal(new Set(ORDEN.map((m) => m.texto)).size, 42);
});
test('nunca dos temas iguales seguidos, ni al volver a empezar', () => {
  for (let i = 0; i < ORDEN.length; i++) {
    assert.notEqual(ORDEN[i].categoria, ORDEN[(i + 1) % ORDEN.length].categoria, `dia ${i}`);
  }
});
test('el mensaje cambia cada dia y es el mismo todo el dia', () => {
  const a = mensajeDelDia(new Date(2026, 10, 2, 6)), b = mensajeDelDia(new Date(2026, 10, 2, 23));
  const c = mensajeDelDia(new Date(2026, 10, 3, 6));
  assert.equal(a.texto, b.texto);
  assert.notEqual(a.categoria, c.categoria);
});
test('tras 42 dias vuelve al mismo', () => {
  assert.equal(mensajeDelDia(new Date(2026, 10, 2)).texto, mensajeDelDia(new Date(2026, 11, 14)).texto);
});
