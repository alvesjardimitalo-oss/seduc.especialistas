import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gestaoHabilitada,podeEditarConta,prepararPermissoes,prepararVinculoConta} from '../assets/js/gestao-usuarios.mjs';
const admin={id:'admin',nome:'Admin',ativo:true,perfil:'superadmin',escolas:[]};
const especialista={id:'prof',nome:'Profissional',ativo:true,perfil:'especialista',gerenciar:false,escolas:['a']};
test('novo cadastro não seleciona automaticamente ficha de outra pessoa sem UID',()=>{
 const s=readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');
 const trecho=s.slice(s.indexOf('function camposVinculoUsuario('),s.indexOf('function configurarVinculoUsuario('));
 const criar=new Function('cache','safe','editorJornadaVisual',trecho+';return camposVinculoUsuario();');
 const html=criar({profissionais:[{id:'livre',uid:'',nome:'Profissional Existente',especialidade:'Fono'}]},String,()=>'<div>Escala</div>');
 assert.ok(!html.includes('selected'));assert.ok(html.includes('Criar ficha automaticamente'));
 assert.ok(html.includes('name="especialidade_usuario" maxlength="150" value=""'));
});
test('delegação à Secretaria continua habilitada após salvar e recarregar',()=>{
 const dados=prepararPermissoes(admin,especialista,{nome:'Secretaria',perfil:'secretaria',ativo:'true',gerenciar:'true'},[]);
 assert.equal(gestaoHabilitada(JSON.parse(JSON.stringify(dados))),true);
 assert.equal(gestaoHabilitada({...dados,excluido:true}),false);
});
test('delegado não edita administração nem concede novos gerenciadores',()=>{
 const sec={id:'sec',ativo:true,perfil:'secretaria',gerenciar:true};
 assert.equal(podeEditarConta(sec,admin),false);
 assert.equal(podeEditarConta(sec,{...especialista,gerenciar:true}),false);
 assert.throws(()=>prepararPermissoes(sec,especialista,{nome:'Nova Gestora',perfil:'secretaria',ativo:'true',gerenciar:'true'},[]));
 assert.throws(()=>prepararPermissoes(admin,admin,{nome:'Admin',perfil:'especialista',ativo:'true'},['a']));
});
test('cadastro integrado cria ficha com mesmo UID e vínculos em todas as escolas',()=>{
 const horarios=[{dia:3,inicio:'07:00',fim:'17:00'}];
 const plano=prepararVinculoConta('prof',{...especialista,escolas:['a','b']},{aplicar:true,especialidade:'Fonoaudióloga',horarios,slots:[62],jornada:'10 horas'});
 assert.equal(plano.ficha.uid,'prof');assert.equal(plano.novos.length,2);
 assert.ok(plano.novos.every(v=>v.profissional_id===plano.ficha.id&&v.uid==='prof'));
 assert.throws(()=>prepararVinculoConta('prof',especialista,{aplicar:true,especialidade:'Fono',horarios,slots:[62],fichaId:'outra',fichas:[{id:'outra',uid:'alheio'}]}));
});
test('mudança de escola encerra vínculo antigo e preserva escala existente sem duplicar',()=>{
 const horarios=[{dia:3,inicio:'07:00',fim:'17:00'}],vinculos=[{id:'va',uid:'prof',profissional_id:'p',escola_id:'a',ativo:true,cargo:'Fono',horarios},{id:'vb',uid:'prof',escola_id:'b',ativo:true}];
 const plano=prepararVinculoConta('prof',especialista,{aplicar:true,especialidade:'Fono',fichas:[{id:'p',uid:'prof'}],vinculos,horarios,slots:[62]});
 assert.deepEqual(plano.encerrar,['vb']);assert.equal(plano.novos.length,0);
 assert.deepEqual(prepararVinculoConta('prof',{...especialista,ativo:false},{vinculos}).encerrar,['va','vb']);
});
test('especialista ativo exige escola e jornada antes de gravar o acesso',()=>{
 assert.throws(()=>prepararPermissoes(admin,especialista,{nome:'Profissional',ativo:'true',perfil:'especialista'},[]));
 assert.throws(()=>prepararVinculoConta('prof',especialista,{aplicar:true,especialidade:'Fono'}));
 assert.throws(()=>prepararVinculoConta('prof',especialista,{aplicar:false}));
});
