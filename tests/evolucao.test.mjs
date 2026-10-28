import test from 'node:test';
import assert from 'node:assert/strict';
import {metasAtuais,indicadoresConsultas,analisarAcompanhamento,validarMeta} from '../assets/js/evolucao.mjs';
test('metas redefinidas preservam a origem e usam a revisão mais recente',()=>{
 const metas=[{id:'antiga',substitui_id:''},{id:'atual',substitui_id:'antiga'}];
 const revisoes=[{id:'r1',meta_id:'atual',status:'atingida',criado_em:'2026-10-27'},{id:'r2',meta_id:'atual',status:'revisar',criado_em:{toDate:()=>new Date('2026-10-28')}}];
 const r=metasAtuais(metas,revisoes);
 assert.equal(r.length,1);assert.equal(r[0].status,'revisar');assert.equal(metas.length,2);
});
test('gráficos contam realizados e separam profissionais homônimos por UID',()=>{
 const visitas=[{autor_uid:'a',autor_nome:'Fictícia',status:'realizado',data:'2026-10-29T02:00:00Z',especialidade:'Fono'},
 {autor_uid:'b',autor_nome:'Fictícia',status:'realizado',data:'2026-10-28T13:00:00Z',especialidade:'Fono'},
 {autor_uid:'a',status:'cancelado',data:'2026-10-28T13:00:00Z'}];
 const i=indicadoresConsultas(visitas,[{status:'falta_aluno'}]);
 assert.equal(i.realizados,2);assert.equal(i.profissionais.length,2);assert.equal(i.meses[0].rotulo,'2026-10');assert.equal(i.faltas,1);
});
test('análise explica pendências sem inferir diagnóstico nem progresso por quantidade de consultas',()=>{
 const r=analisarAcompanhamento([{id:'m',prazo:'2026-10-27'}],[],[{status:'falta_aluno'}],new Date('2026-10-28'));
 assert.equal(r.estados.find(e=>e.id==='definida').total,1);
 assert.equal(r.alertas.length,3);
 assert.equal(analisarAcompanhamento([],[],[]).alertas.length,1);
});
test('valida ponto de partida, critério e prazo sem escala universal automática',()=>{
 assert.throws(()=>validarMeta({titulo:'a',linha_base:'',criterio:'b',prazo:'inválida'}));
 assert.throws(()=>validarMeta({titulo:'a',linha_base:'b',criterio:'c',prazo:'inválida'}));
 const r=validarMeta({titulo:' Meta ',linha_base:' Observação ',criterio:' Evidência ',prazo:'2026-12-01'});
 assert.equal(r.titulo,'Meta');assert.ok(r.prazo instanceof Date);
});
