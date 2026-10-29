import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {paginasPermitidas,podeAbrirPagina,cacheVazio} from '../assets/js/acesso-equipe.mjs';
import {aplicarExclusoes} from '../assets/js/perfil-acompanhamento.mjs';
test('especialista recebe somente operação clínica, sem páginas e atalhos administrativos',()=>{
 const p={ativo:true,perfil:'especialista'};assert.deepEqual(paginasPermitidas(p),['Painel','Alunos','Agenda','Atendimentos','Tutorial']);
 for(const pagina of ['Usuários','Servidores','Auditoria','Escolas','Profissionais','Frequência','Relatórios'])assert.equal(podeAbrirPagina(p,pagina),false);
 assert.equal(podeAbrirPagina(p,'Ficha do aluno'),true);
});
test('requisição antiga não repõe dados depois da troca de sessão',async()=>{
 const s=readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8'),fn=s.slice(s.indexOf('async function refresh('),s.indexOf('async function abrirTela('));
 let liberar;const aguardar=new Promise(r=>liberar=r),initial={...cacheVazio(),escolas:[{id:'e'}]};
 const deps={aplicarExclusoes,canManage:()=>false,profile:{perfil:'especialista'},db:{},collection:()=>'',where:()=>'',query:()=>'',getDocs:async()=>{await aguardar;return{docs:[{id:'anterior',data:()=>({})}]}},colecoesCarregadas:new Set()};
 const api=new Function('d','initial',`const {${Object.keys(deps).join(',')}}=d;let versaoSessao=0,cache=initial,erroRelatorios,erroMetas,errosCarregamento;`+fn+';return {refresh,mudar:()=>versaoSessao++,dados:()=>cache};')(deps,initial);
 const pendente=api.refresh(['alunos']);api.mudar();liberar();await pendente;assert.equal(api.dados(),initial);assert.equal(api.dados().alunos.length,0);
});
test('falha ao gravar ciência dos termos mantém acesso bloqueado',async()=>{
 const s=readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8'),fn=s.slice(s.indexOf('async function mostrarTermosSeguranca(){'),s.indexOf('function showSetup()'));
 const elementos=new Map();let entradas=0;
 const deps={versaoSessao:0,user:{uid:'local'},profile:{ativo:true},db:{},auth:{},TERMOS_VERSAO:'teste',root:{innerHTML:''},
  getDoc:async()=>({exists:()=>false}),doc:()=>'',setDoc:async()=>{throw Error('Falha simulada')},serverTimestamp:()=>'',
  document:{getElementById:id=>{if(!elementos.has(id))elementos.set(id,{});return elementos.get(id)}},textoAvisoSeguranca:()=>'',signOut:async()=>{},showError:e=>{throw e},registrarTermosNoDispositivo:()=>{},entrarAposTermos:async()=>entradas++,console:{warn:()=>{}}};
 await new Function('d',`const {${Object.keys(deps).join(',')}}=d;let termosSessaoConfirmados=false;`+fn+';return mostrarTermosSeguranca();')(deps);
 elementos.get('lgpd-confirmar').checked=true;await elementos.get('lgpd-entrar').onclick();assert.equal(entradas,0);assert.match(elementos.get('lgpd-status').textContent,/Não foi possível registrar/);
});
test('perfis de gestão, direção, consulta e contas desativadas mantêm limites explícitos',()=>{
 assert.equal(podeAbrirPagina({ativo:true,perfil:'superadmin'},'Usuários'),true);
 assert.equal(podeAbrirPagina({ativo:true,perfil:'secretaria',gerenciar:false},'Usuários'),false);
 assert.equal(podeAbrirPagina({ativo:true,perfil:'secretaria',gerenciar:true},'Usuários'),true);
 assert.equal(podeAbrirPagina({ativo:true,perfil:'visualizador'},'Ficha do aluno'),false);
 assert.deepEqual(paginasPermitidas({ativo:false,perfil:'superadmin'}),[]);
 assert.deepEqual(paginasPermitidas({ativo:true,perfil:'superadmin',excluido:true}),[]);
});
test('troca de conta limpa dados clínicos, documentos administrativos, filtros e credenciais temporárias',()=>{
 const source=readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');
 const inicio=source.indexOf('function limparSessaoLocal(){'),fim=source.indexOf('async function initialize()',inicio);
 const executar=new Function('cacheVazio',`let versaoSessao=0,cache={alunos:[{nome:'Anterior'}]},profile={perfil:'superadmin'},tab='Auditoria',alunoSelecionado='a',abaFicha='plano',filtrosConsulta={nome:'Anterior'},filtrosAgenda={},filtrosAtendimentos={},filtrosRelatorio={},acessosAuditoriaCache=['privado'],credenciaisUltimoTeste={senha:'ficticia'},termosSessaoConfirmados=true,errosCarregamento=[],erroRelatorios=false,erroMetas=false;
 const cacheHistoricos=new Map([['a','privado']]),colecoesCarregadas=new Set(['alunos_diagnosticos']),document={querySelectorAll:()=>[]};`+source.slice(inicio,fim)+`;limparSessaoLocal();return {cache,profile,tab,alunoSelecionado,acessosAuditoriaCache,credenciaisUltimoTeste,termosSessaoConfirmados,historicos:cacheHistoricos.size,carregadas:colecoesCarregadas.size};`);
 const r=executar(cacheVazio);assert.ok(Object.values(r.cache).every(x=>Array.isArray(x)&&!x.length));assert.equal(r.tab,'Painel');assert.equal(r.profile,null);assert.equal(r.acessosAuditoriaCache,null);assert.equal(r.credenciaisUltimoTeste,null);assert.equal(r.historicos,0);assert.equal(r.carregadas,0);assert.equal(r.termosSessaoConfirmados,false);
});
