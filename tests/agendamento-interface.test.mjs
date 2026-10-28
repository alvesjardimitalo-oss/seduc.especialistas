import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');
test('formulário converte data antes de validar agenda e atendimento',()=>{
 assert.match(source,/const date=fromInputDate\(d\.inicio\),duracao=Number\(d\.duracao_min\)/);
 assert.match(source,/podeAgendar\(\{inicio:date,duracaoMin:duracao/);
 assert.doesNotMatch(source,/eligible\(d\.inicio,d\.escola_id/);
});
test('reservas de meia hora usam transação do Firestore',()=>{
 assert.match(source,/async function salvarAgendamento\(payload\)/);
 assert.match(source,/runTransaction\(db,async tx=>/);
 assert.match(source,/agenda_slots/);
});

test('atendimento imediato não exige data futura no validador de agenda',()=>{assert.match(source,/if\(isAgenda\)\{/);
 assert.match(source,/else if\(date\.getTime\(\)>Date\.now\(\)\+60000\)/);});

test('consultas são abertas dentro do agendamento e exibem progresso',()=>{
 assert.match(source,/data-abrir-agendamento/);
 assert.match(source,/function abrirAgendamento\(id\)/);
 assert.match(source,/async function iniciarConsultaAgendada\(id\)/);
 assert.match(source,/function abrirConsultaAgendada\(id\)/);
 assert.match(source,/async function finalizarConsultaAgendada\(id,observacao,evolucao=/);
 assert.match(source,/status:'em_atendimento',iniciado_em:serverTimestamp\(\)/);
 assert.match(source,/status:'realizado',finalizado_em:serverTimestamp\(\),atendimento_id:atendimento.id/);
});
test('finalização atômica vincula atendimento e observações ao agendamento',()=>{
 assert.match(source,/doc\(db,'atendimentos','agenda_'\+id\)/);
 assert.match(source,/tx\.set\(atendimento,/);
 assert.match(source,/tx\.set\(nota,/);
 assert.match(source,/tx\.update\(ref,\{status:'realizado'/);
 assert.match(source,/if\(a\.status!=='em_atendimento'\)/);
});
