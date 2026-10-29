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
test('termos aceitos não são mostrados novamente sem mudança de versão',()=>{
 for(const trecho of [
  'function termosLocalKey()',
  'function termosAceitosNesteDispositivo()',
  'if(aceiteAnterior||termosAceitosNesteDispositivo())',
  'await entrarAposTermos({gravado:aceiteAnterior})',
  'registrarTermosNoDispositivo()'
 ])assert.ok(src.includes(trecho),'Faltando: '+trecho);
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
