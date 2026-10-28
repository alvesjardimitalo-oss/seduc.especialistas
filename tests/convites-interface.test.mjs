import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');
const rules=readFileSync(new URL('../firestore.rules',import.meta.url),'utf8');
test('tela de usuarios inclui pré-autorização sem UID e escolas',()=>{
 for(const part of ['Pré-autorizar especialista','function abrirPreAutorizacao()','name="email"',
  'name="escolas"','convites_usuarios','Aguardando primeiro login','function alternarConvite('])
  assert.ok(app.includes(part),'Ausente: '+part);
});
test('login Google verificado ativa só perfil especialista e aceita termos LGPD',()=>{
 for(const part of ['u.emailVerified','providerId===\\'google.com\\'','conviteRef.data().ativo===true',
 'perfil:convite?\\'especialista\\':\\'pendente\\'','await mostrarTermosSeguranca()'])
  assert.ok(app.includes(part),'Ausente: '+part);
});
test('regras proíbem convite virar administrador e limitam acesso a email verificado',()=>{
 for(const part of ["match /convites_usuarios/{email}","request.resource.data.perfil == 'especialista'",
  "request.auth.token.email_verified == true","request.auth.token.firebase.sign_in_provider == 'google.com'",
  "request.resource.data.gerenciar == false"])
  assert.ok(rules.includes(part),'Ausente: '+part);
});
