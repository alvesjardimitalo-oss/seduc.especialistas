import test from 'node:test';import assert from 'node:assert/strict';
import {podeGerirConsulta,dadosDaRemarcacao} from '../assets/js/gestao-agenda.mjs';
const consulta={id:'consulta',autor_uid:'especialista',autor_nome:'Profissional fictícia',escola_id:'a',aluno_id:'aluno',vinculo_id:'v',duracao_min:60,especialidade:'Fonoaudiologia',status:'agendado'};
test('administração e secretaria delegada podem gerir consulta de outra profissional',()=>{
 assert.equal(podeGerirConsulta(consulta,{uid:'admin',ativo:true,perfil:'superadmin'}),true);
 assert.equal(podeGerirConsulta(consulta,{uid:'sec',ativo:true,perfil:'secretaria',gerenciar:true}),true);
});
test('profissional só gere sua consulta; visualizadores e secretaria de consulta não gerem',()=>{
 assert.equal(podeGerirConsulta(consulta,{uid:'especialista',ativo:true,perfil:'especialista'}),true);
 for(const pessoa of [{uid:'outra',ativo:true,perfil:'especialista'},{uid:'sec',ativo:true,perfil:'secretaria',gerenciar:false},{uid:'dir',ativo:true,perfil:'direcao'},{uid:'v',ativo:true,perfil:'visualizador'},{uid:'admin',ativo:false,perfil:'superadmin'}])assert.equal(podeGerirConsulta(consulta,pessoa),false);
});
test('remarcação administrativa preserva profissional, aluno, vínculo e duração',()=>{
 const resultado=dadosDaRemarcacao(consulta,{inicio:new Date('2035-01-02T11:00:00Z'),novoId:'nova',motivo:'Pedido da família',atorUid:'admin',em:'hora-do-servidor'});
 assert.equal(resultado.novo.autor_uid,'especialista');assert.equal(resultado.novo.agendado_por_uid,'admin');
 for(const campo of ['aluno_id','escola_id','vinculo_id','duracao_min','autor_nome'])assert.equal(resultado.novo[campo],consulta[campo]);
 assert.equal(resultado.origem.status,'remarcado');assert.equal(resultado.origem.alterado_por_uid,'admin');assert.equal(resultado.origem.motivo_remarcacao,'Pedido da família');assert.equal(resultado.novo.remarcado_de,'consulta');
});
test('remarcação pela própria profissional preserva comportamento e falta anterior',()=>{
 const resultado=dadosDaRemarcacao({...consulta,status:'falta_aluno'},{inicio:new Date(),novoId:'nova',motivo:'Retorno',atorUid:'especialista',em:'agora'});
 assert.equal(resultado.origem.status,'falta_aluno');assert.equal(resultado.novo.autor_uid,'especialista');assert.ok(!('agendado_por_uid' in resultado.novo));
});
