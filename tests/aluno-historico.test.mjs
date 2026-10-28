import test from 'node:test';
import assert from 'node:assert/strict';
import {consultasDoAluno,validarRelatorio,filtrarConsultas} from '../assets/js/aluno-historico.mjs';
test('ficha reúne consultas do aluno sem incluir outra criança',()=>{
 const visitas=[{id:'v',aluno_id:'a',data:'2026-10-28T12:00:00Z',status:'realizado'},{id:'outro',aluno_id:'b'}];
 const agenda=[{id:'ag',aluno_id:'a',inicio:{toDate:()=>new Date('2026-10-29T12:00:00Z')},status:'agendado'}];
 const r=consultasDoAluno('a',visitas,agenda);
 assert.deepEqual(r.map(x=>x.id),['ag','v']);
 assert.deepEqual(r.map(x=>x.tipo),['agendamento','atendimento']);
 assert.equal(visitas[0].tipo,undefined);
});
test('filtros de consulta combinam data, profissional, especialidade e situação',()=>{
 const registros=[
 {id:'v',aluno_id:'a',autor_uid:'p',especialidade:'Fono',status:'realizado',data:'2026-10-29T02:59:59Z'},
 {id:'c',aluno_id:'a',autor_uid:'p',especialidade:'Fono',status:'cancelado',data:'2026-10-28T12:00:00Z'}
 ];
 const filtros={de:'2026-10-28',ate:'2026-10-28',profissional:'p',especialidade:'Fono',status:'realizado',tipo:'atendimento'};
 assert.deepEqual(consultasDoAluno('a',registros,[],filtros).map(x=>x.id),['v']);
 assert.equal(consultasDoAluno('a',registros,[],{profissional:'outro'}).length,0);
 assert.throws(()=>consultasDoAluno('a',registros,[],{de:'2026-10-29',ate:'2026-10-28'}),/data final/);
});
test('relatório exige título e texto com limites e preserva texto simples',()=>{
 assert.deepEqual(validarRelatorio({titulo:' Evolução ',texto:' Registro fictício '}),{titulo:'Evolução',texto:'Registro fictício'});
 for(const item of [{titulo:'',texto:'x'},{titulo:'a',texto:' '},{titulo:'a'.repeat(151),texto:'x'},{titulo:'a',texto:'x'.repeat(5001)}])assert.throws(()=>validarRelatorio(item));
 assert.equal(validarRelatorio({titulo:'a',texto:'<b>texto</b>'}).texto,'<b>texto</b>');
});

test('consulta geral filtra nome com acentos, profissional e período personalizado',()=>{
 const registros=[{aluno_id:'a',autor_uid:'p',inicio:'2026-10-28T12:00:00Z',status:'agendado'},{aluno_id:'b',autor_uid:'p',inicio:'2026-10-28T12:00:00Z',status:'agendado'}];
 const alunos=[{id:'a',nome:'Criança Fictícia'},{id:'b',nome:'Outro Aluno'}];
 assert.equal(filtrarConsultas(registros,alunos,{nome:'crianca ficticia',profissional:'p',de:'2026-10-28',ate:'2026-10-28'}).length,1);
 assert.equal(filtrarConsultas(registros,alunos,{nome:'inexistente'}).length,0);
});
