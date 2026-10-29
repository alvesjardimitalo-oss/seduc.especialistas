import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resumirAluno} from '../assets/js/consultas-resumo.mjs';
import {aplicarExclusoes,perfisAcompanhados,consultasUnificadas,podeExcluirConsulta,consultaEncerrada} from '../assets/js/perfil-acompanhamento.mjs';
const alunos=[{id:'a',nome:'Aluna A'},{id:'b',nome:'Aluno B'}];
test('quadro expansível apresenta painel do aluno mesmo sem atendimento finalizado',()=>{
 const s=readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');
 const painel=s.slice(s.indexOf('function painelResumoAluno('),s.indexOf('function tutorialAtivo('));
 const tela=s.slice(s.indexOf('function linhaConsultaPerfil('));
 const deps={cache:{alunos,atendimentos:[],agendamentos:[{id:'ag',aluno_id:'a',escola_id:'escola',status:'cancelado',autor_uid:'prof',inicio:new Date()}],revisoes_metas:[],alunos_necessidades:[],alunos_diagnosticos:[{aluno_id:'a',diagnostico:'Informação clínica de teste',origem:'Fonte fictícia',plano:'Objetivo individual',autor_nome:'Profissional'}]},
 profile:{ativo:true,perfil:'superadmin'},user:{uid:'admin'},canWrite:()=>false,safe:x=>String(x??''),schoolName:()=> 'Escola',formatDate:()=> 'Data',dataMs:()=>0,resumirAluno,perfisAcompanhados,podeExcluirConsulta,consultaEncerrada};
 const executar=new Function('deps',`const {${Object.keys(deps).join(',')}}=deps;`+painel+tela+';return quadrosAcompanhamento();');
 const html=executar(deps);assert.match(html,/<details class="card student-history">/);assert.match(html,/Aluna A/);assert.doesNotMatch(html,/Aluno B/);
 assert.match(html,/Resumo do acompanhamento/);assert.match(html,/Informação clínica de teste/);assert.match(html,/Excluir consulta/);
});
test('perfis incluem alunos com consultas apenas agendadas, em andamento ou canceladas',()=>{
 const agenda=['agendado','em_atendimento','cancelado'].map((status,i)=>({id:String(i),aluno_id:'a',status}));
 const grupos=perfisAcompanhados(alunos,[],agenda);assert.equal(grupos.length,1);assert.equal(grupos[0].consultas.length,3);
});
test('uma consulta finalizada não aparece duas vezes ao unir agenda e atendimento',()=>{
 const agenda=[{id:'ag',aluno_id:'a',status:'realizado'}],visitas=[{id:'at',aluno_id:'a',agendamento_id:'ag',status:'realizado'}];
 assert.equal(consultasUnificadas('a',visitas,agenda).length,1);assert.equal(perfisAcompanhados(alunos,visitas,agenda)[0].consultas[0].tipo,'atendimento');
});
test('exclusão remove da agenda e do histórico vinculados e restauração os mantém',()=>{
 const cache={agendamentos:[{id:'ag',aluno_id:'a',atendimento_id:'at'}],atendimentos:[{id:'at',agendamento_id:'ag'}],consultas_excluidas:[{tipo:'agendamentos',registro_id:'ag',ativo:true}]};
 assert.equal(aplicarExclusoes(cache).agendamentos.length,0);assert.equal(aplicarExclusoes(cache).atendimentos.length,0);
 cache.consultas_excluidas[0].ativo=false;assert.equal(aplicarExclusoes(cache).atendimentos.length,1);
});
test('somente administração ou profissional responsável excluem e consultas ativas precisam ser encerradas',()=>{
 const r={autor_uid:'prof',status:'cancelado'};
 assert.equal(podeExcluirConsulta({ativo:true,perfil:'superadmin'},'admin',r),true);
 assert.equal(podeExcluirConsulta({ativo:true,perfil:'especialista'},'prof',r),true);
 assert.equal(podeExcluirConsulta({ativo:true,perfil:'especialista'},'outra',r),false);
 assert.equal(podeExcluirConsulta({ativo:false,perfil:'superadmin'},'admin',r),false);
 assert.equal(consultaEncerrada(r),true);assert.equal(consultaEncerrada({status:'em_atendimento'}),false);
});
test('filtros preservam aluno correto e não misturam profissionais entre perfis',()=>{
 const agenda=[{id:'um',aluno_id:'a',autor_uid:'p1'},{id:'dois',aluno_id:'b',autor_uid:'p2'}];
 const grupos=perfisAcompanhados(alunos,[],agenda,{profissional:'p2'});assert.equal(grupos.length,1);assert.equal(grupos[0].aluno.id,'b');
});
