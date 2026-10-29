import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {resumirAluno,etiquetasEvolucao} from '../assets/js/consultas-resumo.mjs';
import {consultasUnificadas} from '../assets/js/perfil-acompanhamento.mjs';
const s=readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');
const fn=s.slice(s.indexOf('function fichaAluno(){'),s.indexOf('function novoRelatorioAluno(){'));
function ficha(aba='geral',perfil='superadmin',filtros={},visitas=null){
 const deps={abaFicha:aba,alunoSelecionado:'a',filtrosConsulta:filtros,
 cache:{alunos:[{id:'a',nome:'Aluna <Teste>',escola_id:'e',nascimento:'2018-02-01',ativo:true}],atendimentos:[{id:'v',aluno_id:'a',status:'realizado',data:new Date(),autor_uid:'prof',texto:'Observação confidencial',evolucao_observada:'avanco_observado'}],agendamentos:[],revisoes_metas:[],alunos_diagnosticos:[{aluno_id:'a',diagnostico:'Diagnóstico confidencial',plano:'Objetivo individual',origem:'Documento'}],alunos_necessidades:[],relatorios_alunos:[]},
 profile:{perfil},canWrite:()=>perfil==='especialista',canManage:()=>perfil==='superadmin',safe:x=>String(x??'').replaceAll('<','&lt;').replaceAll('>','&gt;'),
 schoolName:()=> 'Escola de Teste',professionalName:()=> 'Profissional',formatDate:()=> 'Data',dataMs:d=>new Date(d||0).getTime(),resumirAluno,consultasUnificadas,etiquetasEvolucao,
 linhaConsultaPerfil:r=>'<details data-consulta="'+r.id+'"><summary>Consulta</summary></details>',painelDiagnosticoAluno:()=>'<section>Plano clínico</section>',painelMetas:()=>'<section>Metas</section>',erroRelatorios:false};
 if(visitas)deps.cache.atendimentos=visitas;
 return new Function('d',`const {${Object.keys(deps).join(',')}}=d;`+fn+';return fichaAluno();')(deps);
}
test('última consulta considera atendimento real, mesmo quando a consulta foi antecipada',()=>{
 const visitas=[{id:'antiga',aluno_id:'a',autor_uid:'p',status:'realizado',inicio:new Date('2030-01-01'),data:new Date('2026-01-01'),texto:'Anotação antiga com horário previsto distante.'},{id:'recente',aluno_id:'a',autor_uid:'p',status:'realizado',inicio:new Date('2026-01-01'),data:new Date('2026-01-02'),texto:'Última anotação efetivamente realizada.'}];
 const html=ficha('geral','superadmin',{},visitas);assert.match(html,/Última anotação efetivamente realizada/);assert.doesNotMatch(html,/Anotação antiga com horário previsto distante/);
});
test('visão geral apresenta identidade, indicadores e síntese sem empilhar filtros e gráficos',()=>{
 const html=ficha();assert.match(html,/Aluna &lt;Teste&gt;/);assert.match(html,/Última consulta/);assert.match(html,/Diagnóstico confidencial/);
 assert.match(html,/aria-selected="true"/);assert.doesNotMatch(html,/Filtrar histórico|Atendimentos por mês|Data inicial/);
});
test('aba consultas preserva histórico e filtros sem repetir o diagnóstico',()=>{
 const html=ficha('consultas');assert.match(html,/Histórico de consultas/);assert.match(html,/data-consulta="v"/);assert.match(html,/Consultas excluídas/);assert.doesNotMatch(html,/Diagnóstico confidencial/);
 assert.match(ficha('consultas','superadmin',{de:'2027-10-01',ate:'2026-01-01'}),/data final deve ser igual/);
});
test('abas isolam plano, relatórios e cadastro, e perfis de leitura não recebem texto clínico',()=>{
 assert.match(ficha('plano'),/Plano clínico/);assert.match(ficha('plano'),/Metas/);
 assert.match(ficha('relatorios'),/Nenhum relatório emitido/);assert.match(ficha('dados'),/01\/02\/2018/);
 const restrita=ficha('geral','direcao');assert.doesNotMatch(restrita,/Diagnóstico confidencial|Observação confidencial/);
});
