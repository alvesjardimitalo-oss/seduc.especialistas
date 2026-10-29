import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {aplicarExclusoes} from '../assets/js/perfil-acompanhamento.mjs';
const source=readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');
const trecho=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
test('início antecipado abre consulta com horário real, substitui cache antigo e retoma sem duplicar',async()=>{
 const inicio=new Date(Date.now()+3600000),real=new Date();
 let registro={autor_uid:'prof',status:'agendado',inicio},eventos=0,leituras=0,aberturas=0;
 let cache={agendamentos:[{id:'a',...registro},{id:'a',...registro}],alunos:[]};
 const deps={canWrite:()=>true,user:{uid:'prof'},db:{},doc:()=>({}),
  runTransaction:async(db,fn)=>fn({get:async()=>({exists:()=>true,data:()=>({...registro})}),update:(ref,d)=>{registro={...registro,...d}}}),
  registrarEvento:()=>{eventos++},serverTimestamp:()=>real,getDoc:async()=>{leituras++;return{id:'a',exists:()=>true,data:()=>({...registro})}},render:()=>{},
  showError:e=>{throw e},modal:()=>{aberturas++},safe:String,schoolName:()=>'',formatDate:d=>String(d),camposRegistroConsulta:()=>'',
  document:{querySelector:()=>null}
 };
 const executar=new Function('deps','initial',`const {${Object.keys(deps).join(',')}}=deps;let cache=initial;`+
  trecho('async function iniciarConsultaAgendada(','async function finalizarConsultaAgendada(')+
  ';return {iniciar:iniciarConsultaAgendada,abrir:abrirConsultaAgendada,cache:()=>cache};');
 const api=executar(deps,cache);
 await api.iniciar('a');api.abrir('a');await api.iniciar('a');api.abrir('a');
 assert.equal(eventos,1);assert.equal(aberturas,2);assert.equal(leituras,2);
 assert.equal(api.cache().agendamentos.length,1);assert.equal(registro.inicio,inicio);assert.equal(registro.iniciado_em,real);
 registro={...registro,autor_uid:'outro'};await assert.rejects(api.iniciar('a'),/responsável/);
 registro={...registro,autor_uid:'prof',status:'realizado'};await assert.rejects(api.iniciar('a'),/disponível/);
});
test('atualizações parciais substituem os registros, inclusive em múltiplos lotes de escolas',async()=>{
 const initial={escolas:Array.from({length:11},(_,i)=>({id:String(i)})),agendamentos:[{id:'antigo',status:'agendado'}],atendimentos:[],notas_atendimento:[]};
 let chamadas=0;
 const deps={versaoSessao:0,aplicarExclusoes,canManage:()=>false,profile:{perfil:'especialista'},db:{},collection:(db,key)=>key,where:(...args)=>args,query:(...args)=>args,
 getDocs:async()=>({docs:[{id:'novo'+(++chamadas%2),data:()=>({status:'em_atendimento'})}]}),colecoesCarregadas:new Set()};
 const executar=new Function('deps','initial',`const {${Object.keys(deps).join(',')}}=deps;let cache=initial,erroRelatorios,erroMetas,errosCarregamento;`+
 trecho('async function refresh(','async function abrirTela(')+';return {refresh,cache:()=>cache};');
 const api=executar(deps,initial);await api.refresh(['agendamentos']);await api.refresh(['agendamentos']);
 assert.equal(api.cache().agendamentos.length,2);assert.ok(api.cache().agendamentos.every(a=>a.status==='em_atendimento'));
 assert.equal(initial.agendamentos.length,1);assert.equal(chamadas,4);
});
