import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {horariosLivres,listarProfissionaisDaEscola} from '../assets/js/agenda-formulario.mjs';
import {buscarAlunosDisponiveis} from '../assets/js/busca-alunos.mjs';
const escola='a',usuario='espA';
const vinculos=[{uid:'espA',escola_id:'a',ativo:true,horarios:[{dia:1,inicio:'08:00',fim:'12:00'}],cargo:'Psicopedagoga'}];
const usuarios=[{id:'espA',perfil:'especialista',ativo:true,escolas:['a'],nome:'Maria Especialista'}];
test('gestão seleciona especialista apenas quando vínculo e conta estão ativos',()=>{
 const profs=listarProfissionaisDaEscola({escolaId:'a',vinculos,usuarios,gestao:true});
 assert.equal(profs.length,1);
 assert.equal(profs[0].uid,'espA');
 assert.equal(listarProfissionaisDaEscola({escolaId:'b',vinculos,usuarios,gestao:true}).length,0);
 assert.equal(listarProfissionaisDaEscola({escolaId:'a',vinculos,usuarios:[],gestao:true}).length,0);
});
test('data e horário respeitam jornada, reservas e horário em andamento',()=>{
 const agendamentos=[
  {id:'1',autor_uid:'espA',inicio:new Date(2027,10,8,8),duracao_min:30,status:'agendado'},
  {id:'2',autor_uid:'espA',inicio:new Date(2027,10,8,9),duracao_min:30,status:'em_atendimento'}
 ];
 const horas=horariosLivres({data:'2027-11-08',escolaId:'a',uid:'espA',duracaoMin:30,
  vinculos,agendamentos,agora:new Date(2026,9,28)});
 assert.equal(horas.some(x=>x.valor==='08:00'),false);
 assert.equal(horas.some(x=>x.valor==='08:30'),true);
 assert.equal(horas.some(x=>x.valor==='09:00'),false);
 assert.equal(horas.some(x=>x.valor==='12:00'),false);
});
test('busca percorre 74 alunos cadastrados sem exigir 74 novas leituras',()=>{
 const alunos=Array.from({length:74},(_,i)=>({id:'aluno'+(i+1),nome:'Aluno Exemplo '+String(i+1).padStart(2,'0'),escola_id:'a',ativo:true}));
 const r=buscarAlunosDisponiveis(alunos,'a','Aluno Exemplo 74',10);
 assert.equal(r.total,1);
 assert.equal(r.alunos[0].id,'aluno74');
 assert.equal(buscarAlunosDisponiveis(alunos,'a','',10).total,74);
});
const app=readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');
test('novo agendamento da gestao aparece na agenda e salva responsável e ator separadamente',()=>{
 for(const t of ['const canSchedule=()=>canWrite()||canManage()','+ Novo agendamento','function formularioNovoAgendamento()',
 'function configurarFormularioNovoAgendamento()','function abrirNovoAgendamento()',
 'profissional_uid','aluno_id','dia_consulta','hora_consulta','agendado_por_uid',
 'registrarEvento(tx,\\'agendamento\\',ref.id,\\'agendado\\'']){
  assert.ok(app.includes(t),'Falta implementar '+t);
 }
});
