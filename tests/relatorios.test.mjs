import test from 'node:test';
import assert from 'node:assert/strict';
import {diaMunicipal,filtrarRegistros,resumirRelatorio} from '../assets/js/relatorios.mjs';
const visitas=[
 {escola_id:'a',autor_uid:'p1',especialidade:'AEE',data:'2026-10-28T03:00:00Z',aluno_id:'al1',status:'realizado'},
 {escola_id:'a',autor_uid:'p1',especialidade:'AEE',data:{toDate:()=>new Date('2026-10-29T02:59:59Z')},aluno_id:'al1',status:'realizado'},
 {escola_id:'b',autor_uid:'p2',especialidade:'Fono',data:'2026-10-29T03:00:00Z',aluno_id:'al2',status:'realizado'},
 {escola_id:'a',autor_uid:'p1',especialidade:'AEE',data:'2026-10-28T12:00:00Z',aluno_id:'al3',status:'cancelado'}
];
test('período inclui o dia inteiro no horário municipal e aceita Timestamp',()=>{
 assert.equal(diaMunicipal('2026-10-28T02:59:59Z'),'2026-10-27');
 assert.equal(filtrarRegistros(visitas,{de:'2026-10-28',ate:'2026-10-28'}).length,3);
});
test('filtros combinados restringem instituição, autoria e especialidade',()=>{
 assert.equal(filtrarRegistros(visitas,{escola:'a',profissional:'p1',especialidade:'AEE'}).length,3);
 assert.equal(filtrarRegistros(visitas,{escola:'b',profissional:'p1'}).length,0);
});
test('conta alunos distintos realizados, separando cancelamentos e agenda',()=>{
 const agenda=[
  {escola_id:'a',autor_uid:'p1',especialidade:'AEE',inicio:'2026-10-28T14:00:00Z',status:'agendado'},
  {escola_id:'a',autor_uid:'p1',especialidade:'AEE',inicio:'2026-10-28T15:00:00Z',status:'falta_aluno'}
 ];
 assert.deepEqual(resumirRelatorio(visitas,agenda,{escola:'a'}),{realizados:2,alunos:1,agendados:1,faltas:1});
});
test('datas inválidas não entram no período; intervalo invertido é rejeitado',()=>{
 assert.equal(filtrarRegistros([{data:'inválida'},{}],{de:'2026-10-28'}).length,0);
 assert.throws(()=>filtrarRegistros([],{de:'2026-10-29',ate:'2026-10-28'}),/data final/);
 assert.deepEqual(resumirRelatorio([],[]),{realizados:0,alunos:0,agendados:0,faltas:0});
});
