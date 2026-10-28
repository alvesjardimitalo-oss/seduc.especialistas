import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {montarGradeAgenda,diaLocal} from '../assets/js/agenda-calendario.mjs';
const sourceApp=readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');
test('calendário começa na segunda-feira e contém todos os dias do mês',()=>{
 const lista=montarGradeAgenda(2026,10,[{inicio:new Date('2026-11-04T13:30:00Z'),status:'agendado'}]);
 assert.equal(lista.filter(x=>!x.fora).length,30);
 assert.equal(lista.filter(x=>x.fora).length,6);
 assert.equal(lista.find(x=>x.data==='2026-11-04').total,1);
});
test('contabiliza consultas do dia usando somente registros já carregados',()=>{
 const lista=montarGradeAgenda(2026,9,[
  {inicio:new Date(2026,9,28,9),status:'agendado'},
  {inicio:new Date(2026,9,28,11),status:'em_atendimento'},
  {inicio:new Date(2026,9,28,14),status:'falta_aluno'},
  {inicio:new Date(2026,9,29,9),status:'realizado'}
 ]);
 const dia=lista.find(x=>x.data==='2026-10-28');
 assert.equal(dia.total,3);
 assert.equal(dia.pendentes,2);
 assert.equal(dia.faltas,1);
 assert.equal(diaLocal(new Date(2026,9,28,9)),'2026-10-28');
});
test('navegação de calendário usa dados do cache e tem trilha de auditoria',()=>{
 const esperados=[
  'function calendarioAgenda(lista)','data-agenda-mes','data-agenda-dia',
  'data-action="atendimento"','Profissional logada','agendaDiaSelecionado',
  'function registrarEvento(','registrarEvento(tx,\'agendamento\',id,\'reagendado\'',
  'async function mostrarHistoricoAgendamento','cacheHistoricos.has(id)',
  'async function refresh(colecoes=null)',"await refresh(['agendamentos'])"
 ];
 for(const trecho of esperados)assert.ok(sourceApp.includes(trecho),'Trecho ausente: '+trecho);
});
