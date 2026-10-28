import test from 'node:test';
import assert from 'node:assert/strict';
import {conferirAlunosEspeciais,encontrarEscola} from '../assets/js/importacao-servidores.mjs';

const exemplo=()=>({
 esquema:'seduc_alunos_especiais_v1',
 alunos:[{
  id:'alu_0123456789abcdef01234567',
  escola_origem:'ESCOLA MUNICIPAL PROFESSORA WILMA GLÓRIA NUNES MOURÃO',
  escola_id:'creche-wilma-gloria',nome:'Aluno Fictício',turma:'Infantil',
  deficiencia:'Não informada',ano_letivo:2026,linha_origem:8
 }]
});
test('alunos: Wilma Glória continua sendo creche mesmo com nome anterior',()=>{
 const res=conferirAlunosEspeciais(exemplo());
 assert.equal(res.total,1);
 assert.equal(res.registros[0].publico.escola_id,'creche-wilma-gloria');
 assert.equal(res.registros[0].privado.deficiencia,'Não informada');
 assert.equal(res.registros[0].publico.deficiencia,undefined);
});
test('alunos: rejeita destino errado e duplicatas',()=>{
 const d=exemplo();d.alunos[0].escola_id='monteiro-lobato';
 assert.throws(()=>conferirAlunosEspeciais(d));
 const e=exemplo();e.alunos.push({...e.alunos[0]});
 assert.throws(()=>conferirAlunosEspeciais(e));
});
test('alunos: encontra escola já cadastrada com ID automático',()=>{
 const escolas=[{id:'auto1',nome:'Creche Municipal Wilma Gloria Nunes Mourao'},{id:'auto2',nome:'Creche Sebastiana Duarte Cabral'}];
 assert.equal(encontrarEscola('creche-wilma-gloria',escolas),'auto1');
 assert.equal(encontrarEscola('creche-sebastiana-duarte-cabral',escolas),'auto2');
});
