import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');
const rules=readFileSync(new URL('../firestore.rules',import.meta.url),'utf8');

test('gestão cria contas temporárias sem e-mail real, e mostra a senha só uma vez',()=>{
 for(const trecho of [
  'function abrirCriacaoContaTeste()',
  'function criarIdentidadeTemporaria(nome)',
  'function senhaSeguraTemporaria()',
  'crypto.getRandomValues',
  '@seduc-teste.example',
  'createUserWithEmailAndPassword',
  'inMemoryPersistence',
  'credenciaisUltimoTeste={email,senha}',
  'deleteUser(conta)',
  'deleteApp(appTemporario)',
  'ocultar-acesso-teste',
  'copiar-acesso-teste'
 ])assert.ok(src.includes(trecho),'Faltando: '+trecho);
 assert.ok(!src.includes('senha:senha')||src.includes('credenciaisUltimoTeste={email,senha}'));
});
test('o login permite credencial temporária e recuperação somente por e-mail real',()=>{
 for(const trecho of [
  'signInWithEmailAndPassword(auth,email,senha)',
  'sendPasswordResetEmail(auth,endereco)',
  "endereco.endsWith('@seduc-teste.example')",
  'id="email-login"',
  'id="redefinir-senha"'
 ])assert.ok(src.includes(trecho),'Faltando: '+trecho);
});
async function simularEntrada({central,local}){
 const inicio=src.indexOf('async function mostrarTermosSeguranca(){');
 const fim=src.indexOf('\nfunction showSetup()',inicio);
 assert.ok(inicio>=0&&fim>inicio,'Fluxo de termos não encontrado');
 const root={innerHTML:''},elementos=new Map();let entradas=0;
 const deps={
  versaoSessao:0,user:{uid:'usuario-ficticio'},profile:{ativo:true},db:{},auth:{},TERMOS_VERSAO:'2026-10-28-v1',root,
  getDoc:async()=>({exists:()=>central,data:()=>({versao:'2026-10-28-v1'})}),doc:()=>({}),
  termosAceitosNesteDispositivo:()=>local,registrarTermosNoDispositivo:()=>{},
  entrarAposTermos:async()=>{entradas++},showError:e=>{throw e},textoAvisoSeguranca:()=>'',
  document:{getElementById(id){if(!elementos.has(id))elementos.set(id,{});return elementos.get(id)}},
  signOut:async()=>{},setDoc:async()=>{},serverTimestamp:()=>({})
 };
 const executar=new Function('deps',
  'const {'+Object.keys(deps).join(',')+'}=deps;let termosSessaoConfirmados=false;'+
  src.slice(inicio,fim)+';return mostrarTermosSeguranca();');
 await executar(deps);return{entradas,tela:root.innerHTML};
}
test('aceite central válido evita nova confirmação na mesma versão',async()=>{
 const resultado=await simularEntrada({central:true,local:false});
 assert.equal(resultado.entradas,1);assert.equal(resultado.tela,'');
});
test('cache local sem aceite central não libera a sessão',async()=>{
 const resultado=await simularEntrada({central:false,local:true});
 assert.equal(resultado.entradas,0);assert.match(resultado.tela,/lgpd-confirmar/);
});
test('primeiro acesso solicita confirmação dos termos',async()=>{
 const resultado=await simularEntrada({central:false,local:false});
 assert.equal(resultado.entradas,0);assert.match(resultado.tela,/lgpd-confirmar/);
});

test('regras não permitem autocriar usuários privilegiados de teste',()=>{
 for(const trecho of [
  'request.resource.data.conta_teste == true',
  "request.resource.data.perfil == 'especialista'",
  "request.resource.data.gerenciar == false",
  'request.resource.data.teste_criado_por == request.auth.uid',
  'seduc-teste[.]example'
 ])assert.ok(rules.includes(trecho),'Faltando: '+trecho);
});
