import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {resumirAluno,etiquetasEvolucao} from '../assets/js/consultas-resumo.mjs';
import {consultasUnificadas} from '../assets/js/perfil-acompanhamento.mjs';
import {montarContinuidade,separarRegistroEquipe} from '../assets/js/continuidade-equipe.mjs';
const s=readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');
const fn=s.slice(s.indexOf('function nomeAutorRegistro(r){'),s.indexOf('function novoRelatorioAluno(){'));
function ficha(aba='geral',perfil='superadmin',filtros={},visitas=null){
 const deps={abaFicha:aba,alunoSelecionado:'a',filtrosConsulta:filtros,
 cache:{alunos:[{id:'a',nome:'Aluna <Teste>',escola_id:'e',nascimento:'2018-02-01',ativo:true}],atendimentos:[{id:'v',aluno_id:'a',status:'realizado',data:new Date(),autor_uid:'prof',texto:'Observação confidencial',evolucao_observada:'avanco_observado'}],agendamentos:[],revisoes_metas:[],alunos_diagnosticos:[{aluno_id:'a',diagnostico:'Diagnóstico confidencial',plano:'Objetivo individual',origem:'Documento'}],alunos_necessidades:[],relatorios_alunos:[]},
 user:{uid:'prof'},montarContinuidade,separarRegistroEquipe,painelMatriculaAluno:()=>'<section>Matrícula atual</section>',canSchedule:()=>['superadmin','especialista'].includes(perfil),profile:{perfil},canWrite:()=>perfil==='especialista',canManage:()=>perfil==='superadmin',safe:x=>String(x??'').replaceAll('<','&lt;').replaceAll('>','&gt;'),
 schoolName:()=> 'Escola de Teste',professionalName:()=> 'Profissional',formatDate:()=> 'Data',dataMs:d=>new Date(d||0).getTime(),resumirAluno,consultasUnificadas,etiquetasEvolucao,
 linhaConsultaPerfil:r=>'<details data-consulta="'+r.id+'"><summary>Consulta</summary></details>',painelDiagnosticoAluno:()=>'<section>Plano clínico</section>',painelMetas:()=>'<section>Metas</section>',erroRelatorios:false};
 if(visitas)deps.cache.atendimentos=visitas;
 return new Function('d',`const {${Object.keys(deps).join(',')}}=d;`+fn+';return fichaAluno();')(deps);
}
test('última consulta considera atendimento real, mesmo quando a consulta foi antecipada',()=>{
 const visitas=[{id:'antiga',aluno_id:'a',autor_uid:'p',status:'realizado',inicio:new Date('2030-01-01'),data:new Date('2026-01-01'),texto:'Anotação antiga com horário previsto distante.'},{id:'recente',aluno_id:'a',autor_uid:'p',status:'realizado',inicio:new Date('2026-01-01'),data:new Date('2026-01-02'),texto:'Última anotação efetivamente realizada.'}];
 const html=ficha('geral','superadmin',{},visitas);assert.match(html,/Última anotação efetivamente realizada/);assert.doesNotMatch(html,/Anotação antiga com horário previsto distante/);
});
test('acompanhamento reúne última consulta, plano e histórico com quatro abas',()=>{
 const html=ficha();assert.match(html,/Aluna &lt;Teste&gt;/);assert.match(html,/Última consulta/);assert.match(html,/Diagnóstico confidencial/);
 assert.match(html,/aria-selected="true"/);assert.match(html,/Linha do tempo da equipe/);assert.match(html,/Filtrar histórico/);assert.equal((html.match(/role="tab"/g)||[]).length,4);
});
test('atalho antigo de consultas abre acompanhamento unificado',()=>{
 const html=ficha('consultas');assert.match(html,/Linha do tempo da equipe/);assert.match(html,/data-consulta="v"/);assert.match(html,/Consultas excluídas/);assert.match(html,/Diagnóstico confidencial/);
 assert.match(ficha('consultas','superadmin',{de:'2027-10-01',ate:'2026-01-01'}),/data final deve ser igual/);
});
test('abas isolam plano, relatórios e cadastro, e perfis de leitura não recebem texto clínico',()=>{
 assert.match(ficha('plano'),/Plano clínico/);assert.match(ficha('plano'),/Metas/);
 assert.match(ficha('relatorios'),/Nenhum relatório emitido/);assert.match(ficha('dados'),/01\/02\/2018/);
 const restrita=ficha('geral','direcao');assert.doesNotMatch(restrita,/Diagnóstico confidencial|Observação confidencial/);
});

test('anotação extensa permanece visível e integral no acompanhamento',()=>{
 const texto='Registro completo. '.repeat(40)+'Conclusão final importante.';
 const html=ficha('geral','especialista',{},[{id:'v',aluno_id:'a',autor_uid:'prof',status:'realizado',data:new Date(),texto}]);
 assert.match(html,/Conclusão final importante/);assert.doesNotMatch(html,/Ler anotações completas/);assert.match(html,/Registrar atendimento/);assert.match(html,/Agendar retorno/);
});
test('ações clínicas não aparecem para direção',()=>{
 const html=ficha('geral','direcao');assert.doesNotMatch(html,/data-prontuario-iniciar|data-prontuario-registrar|data-prontuario-agendar/);
});
test('cadastro reúne matrícula sem criar uma quinta aba',()=>{assert.match(ficha('dados'),/Matrícula atual/);});

test('ação principal prioriza consulta em andamento e nunca inicia consulta de colega',()=>{
 const trecho=s.slice(s.indexOf('function acoesProntuario'),s.indexOf('function preencherAlunoProntuario'));
 const render=new Function('canWrite','canSchedule','user','safe','dataMs',trecho+';return acoesProntuario;')(()=>true,()=>true,{uid:'eu'},String,d=>new Date(d).getTime());
 const aluno={id:'aluno',ativo:true};
 const registros=[{id:'outra',autor_uid:'colega',status:'em_atendimento'},{id:'futura',autor_uid:'eu',status:'agendado',inicio:'2026-12-01'},{id:'aberta',autor_uid:'eu',status:'em_atendimento',inicio:'2026-10-29'}];
 assert.match(render(aluno,registros),/data-prontuario-iniciar="aberta"/);assert.match(render(aluno,registros),/Continuar atendimento/);
 assert.doesNotMatch(render(aluno,[registros[0]]),/data-prontuario-iniciar/);
 assert.match(render(aluno,[registros[1]]),/Iniciar atendimento/);
 assert.doesNotMatch(render({...aluno,ativo:false},registros),/data-prontuario-/);
});

test('agendamento pelo prontuário preenche aluno após atualizar escola',()=>{
 const trecho=s.slice(s.indexOf('function preencherAlunoProntuario'),s.indexOf('function fichaAluno'));
 const campos={escola_id:{value:'',dispatchEvent(){campos.aluno_id.value='';}},aluno_id:{value:''}};
 const widgets={'#pesquisa-aluno-agenda':{},'#aluno-search-selecionado':{hidden:true},'#aluno-search-resultados':{replaceChildren(){}},'#aluno-search-feedback':{}};
 const form={elements:{namedItem:n=>campos[n]},querySelector:q=>widgets[q]};
 const preencher=new Function('cache','document','Event',trecho+';return preencherAlunoProntuario;')({alunos:[{id:'a',nome:'Teste',escola_id:'e',ativo:true}]},{getElementById:()=>form},class {});
 preencher('a');assert.equal(campos.escola_id.value,'e');assert.equal(campos.aluno_id.value,'a');assert.equal(widgets['#pesquisa-aluno-agenda'].value,'Teste');
});
