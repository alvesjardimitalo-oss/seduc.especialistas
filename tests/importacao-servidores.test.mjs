import test from 'node:test';
import assert from 'node:assert/strict';
import {conferirImportacao,escolasImportacao} from '../assets/js/importacao-servidores.mjs';
const origemWilma='ESCOLA MUNICIPAL PROFESSORA WILMA GLÓRIA NUNES MOURÃO';
const modelo=()=>({
 esquema:'seduc_servidores_v2',
 servidores:[
  {id:'srv_abcdef12345678901234',escola_origem:origemWilma,escola_id:'creche-wilma-gloria',nome:'Servidor Fictício de Testes',cargo:'Auxiliar',ano:2026,linha_origem:3,telefone:'',celular:''}
 ]
});
test('classifica Wilma Glória como creche, sem duplicar escola',()=>{
 assert.equal(escolasImportacao[origemWilma].tipo,'creche');
 assert.equal(escolasImportacao[origemWilma].id,'creche-wilma-gloria');
 const s=conferirImportacao(modelo());
 assert.equal(s.total,1);
 assert.equal(s.contagens['creche-wilma-gloria'],1);
 assert.equal(s.registros[0].publico.escola_id,'creche-wilma-gloria');
});
test('contatos ficam apenas na parte privada do registro',()=>{
 const s=conferirImportacao(modelo());
 assert.equal('telefone' in s.registros[0].publico,false);
 assert.equal('celular' in s.registros[0].publico,false);
 assert.equal('nome' in s.registros[0].privado,false);
});
test('recusa arquivo com escola errada ou identidade repetida',()=>{
 const d=modelo();d.servidores[0].escola_id='monteiro-lobato';
 assert.throws(()=>conferirImportacao(d),/Instituição/);
 const e=modelo();e.servidores.push({...e.servidores[0]});
 assert.throws(()=>conferirImportacao(e),/duplicado/);
});
test('recusa planilha fora do esquema permitido',()=>{
 const d=modelo();d.esquema='incorreto';
 assert.throws(()=>conferirImportacao(d),/incompatível/);
});
