import test from 'node:test';
import assert from 'node:assert/strict';
import {montarListaProfissionais} from '../assets/js/profissionais-visao.mjs';

test('servidores importados aparecem na listagem sem ganhar permissão de especialista',()=>{
 const servidores=[
  {id:'srv_01',nome:'Ana Fictícia',cargo:'Professora',escola_id:'creche-wilma-gloria'},
  {id:'srv_02',nome:'Bruno Fictício',cargo:'Auxiliar',escola_id:'monteiro-lobato'}
 ];
 const lista=montarListaProfissionais(servidores,[],[],[]);
 assert.equal(lista.length,2);
 assert.equal(lista.filter(p=>p.origem==='servidor').length,2);
 assert.ok(lista.every(p=>p.profissional_id===null && p.habilitado===false));
});
test('uma ficha profissional com mesmo ID não duplica servidor',()=>{
 const srv=[{id:'srv_01',nome:'Ana Fictícia',cargo:'Professora',escola_id:'creche-wilma-gloria'}];
 const profissionais=[{id:'srv_01',nome:'Ana Fictícia',especialidade:'Psicopedagogia',uid:''}];
 const lista=montarListaProfissionais(srv,profissionais,[],[]);
 assert.equal(lista.length,1);
 assert.equal(lista[0].profissional_id,'srv_01');
 assert.equal(lista[0].habilitado,false);
 assert.equal(lista[0].especialidade,'Psicopedagogia');
});
test('vínculo ativo identifica habilitação; ficha manual permanece na lista',()=>{
 const lista=montarListaProfissionais(
  [{id:'srv_01',nome:'Ana Fictícia',cargo:'Professora',escola_id:'a'}],
  [{id:'srv_01',nome:'Ana Fictícia',especialidade:'AEE'},
   {id:'p1',nome:'Carla Fictícia',especialidade:'Fonoaudiologia',escolas:['b']}],
  [{profissional_id:'srv_01',escola_id:'a',cargo:'AEE',jornada:'20h',ativo:true}],[]);
 assert.equal(lista.length,2);
 assert.equal(lista.find(p=>p.id==='srv_01').habilitado,true);
 assert.equal(lista.find(p=>p.id==='p1').origem,'profissional');
});
test('vínculo inativo não libera atendimento',()=>{
 const r=montarListaProfissionais(
  [{id:'s1',nome:'Alguém',escola_id:'a'}],
  [{id:'s1',nome:'Alguém'}],
  [{profissional_id:'s1',escola_id:'a',ativo:false}],[]);
 assert.equal(r[0].habilitado,false);
});
