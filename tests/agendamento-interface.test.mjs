import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');
test('formulário converte data antes de validar agenda e atendimento',()=>{
 assert.match(source,/const date=fromInputDate\(d\.inicio\);if\(isAgenda\)eligible\(date,d\.escola_id,Number\(d\.duracao_min\)\)/);
 assert.doesNotMatch(source,/eligible\(d\.inicio,d\.escola_id/);
});
test('reservas de meia hora usam transação do Firestore',()=>{
 assert.match(source,/async function salvarAgendamento\(payload\)/);
 assert.match(source,/runTransaction\(db,async tx=>/);
 assert.match(source,/agenda_slots/);
});

test('atendimento imediato não exige data futura no validador de agenda',()=>{assert.match(source,/if\(isAgenda\)eligible\(date,d\.escola_id,Number\(d\.duracao_min\)\)/);});
