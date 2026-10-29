import test from 'node:test';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {horariosLivres,listarProfissionaisDaEscola,diagnosticarProfissionaisDaEscola} from '../assets/js/agenda-formulario.mjs';
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
test('novo agendamento da gestao aparece na agenda e salva responsavel e ator separadamente',()=>{
 const trechos=[
  'const canSchedule=()=>canWrite()||canManage()',
  '+ Novo agendamento',
  'function formularioNovoAgendamento()',
  'function configurarFormularioNovoAgendamento()',
  'async function abrirNovoAgendamento()',
  'profissional_uid','aluno_id','dia_consulta','hora_consulta','agendado_por_uid',
  "registrarEvento(tx,'agendamento',ref.id,'agendado'"
 ];
 for(const trecho of trechos)assert.ok(app.includes(trecho),'Falta implementar '+trecho);
});

test('conta criada aparece com explicação quando falta vínculo, sem liberar reserva',()=>{
 const r=diagnosticarProfissionaisDaEscola({escolaId:'a',usuarios,vinculos:[]});
 assert.equal(r.length,1);assert.equal(r[0].nome,'Maria Especialista');
 assert.equal(r[0].habilitado,false);assert.match(r[0].motivo,/vínculo e jornada/);
});
test('jornada completa libera seleção; jornada sem slots publicados exige configuração',()=>{
 const v={...vinculos[0],slots_semana:[64,65,66,67,68,69,70,71]};
 assert.equal(diagnosticarProfissionaisDaEscola({escolaId:'a',usuarios,vinculos:[v]})[0].habilitado,true);
 const semSlots=diagnosticarProfissionaisDaEscola({escolaId:'a',usuarios,vinculos});
 assert.equal(semSlots[0].habilitado,false);assert.match(semSlots[0].motivo,/Jornada/);
 assert.equal(diagnosticarProfissionaisDaEscola({escolaId:'a',usuarios,vinculos:[{...v,slots_semana:[64]}]})[0].habilitado,false);
});
test('configuração não contorna conta desativada, escola não autorizada ou perfil incorreto',()=>{
 for(const patch of [{ativo:false},{perfil:'visualizador'},{escolas:['b']}]){
  const r=diagnosticarProfissionaisDaEscola({escolaId:'a',usuarios:[{...usuarios[0],...patch}],vinculos});
  assert.equal(r[0].habilitado,false);
 }
 assert.deepEqual(diagnosticarProfissionaisDaEscola({escolaId:'b',usuarios,vinculos}),[]);
});
test('um vínculo válido basta e vínculos inativos não habilitam a agenda',()=>{
 const v={...vinculos[0],slots_semana:[64,65,66,67,68,69,70,71]};
 assert.equal(diagnosticarProfissionaisDaEscola({escolaId:'a',usuarios,vinculos:[{...v,horarios:[]},v]})[0].habilitado,true);
 assert.equal(diagnosticarProfissionaisDaEscola({escolaId:'a',usuarios,vinculos:[{...v,ativo:false}]})[0].habilitado,false);
});

test('configurar uma conta existente cria ficha e jornada no mesmo lote sem criar outro usuário',async()=>{
 const inicio=app.indexOf('function configurarProfissionalParaAgenda(');
 const fim=app.indexOf('function formularioNovoAgendamento()',inicio);
 const campos=new Map(['uid','especialidade'].map(k=>[k,{value:''}]));
 const operacoes=[];let salvar;
 const colecao=nome=>({nome});
 let sequencia=0;
 const sandbox={
  cache:{usuarios,profissionais:[],vinculos:[]},db:{},
  canManage:()=>true,showError:e=>{throw e},
  modal:(titulo,form,callback)=>{salvar=callback},
  select:()=>'',field:()=>'',editorJornadaVisual:()=>'',configurarEditorJornada:()=>{},
  document:{getElementById:()=>({elements:{namedItem:k=>campos.get(k)}})},
  jornadaDosCampos:()=>({horarios:[{dia:1,inicio:'08:00',fim:'12:00'}],jornada:'4 horas'}),
  gerarSlotsSemana:()=>[64,65,66,67,68,69,70,71],
  collection:(db,nome)=>colecao(nome),
  doc:(db,nome,id)=>id?{colecao:nome,id}:{colecao:db.nome,id:'novo'+(++sequencia)},
  writeBatch:()=>({set:(ref,dados)=>operacoes.push({ref,dados}),update:(ref,dados)=>operacoes.push({ref,dados}),commit:async()=>{}})
 };
 vm.createContext(sandbox);vm.runInContext(app.slice(inicio,fim),sandbox);
 sandbox.configurarProfissionalParaAgenda('a','espA');
 assert.equal(campos.get('uid').value,'espA');
 await salvar({uid:'espA',especialidade:'Psicopedagogia'});
 assert.deepEqual(operacoes.map(o=>o.ref.colecao),['profissionais','vinculos']);
 assert.equal(operacoes[1].dados.profissional_id,operacoes[0].ref.id);
 assert.equal(operacoes[1].dados.uid,'espA');
 assert.equal(operacoes[1].dados.escola_id,'a');
 assert.equal(operacoes[1].dados.slots_semana.length,8);
});
