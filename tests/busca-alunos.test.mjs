import test from 'node:test';
import assert from 'node:assert/strict';
import {buscarAlunosDisponiveis,normalizarBuscaAluno} from '../assets/js/busca-alunos.mjs';
import {readFileSync} from 'node:fs';

const alunos=[
 {id:'1',nome:'João da Silva',matricula:'MAT001',escola_id:'escolaA',ativo:true},
 {id:'2',nome:'Maria Cecília',matricula:'MAT002',escola_id:'escolaA',ativo:true},
 {id:'3',nome:'Ana Paula',matricula:'MAT003',escola_id:'escolaB',ativo:true},
 {id:'4',nome:'José Antunes',matricula:'MAT004',escola_id:'escolaA',ativo:false},
 {id:'5',nome:'João Souza',matricula:'MAT005',escola_id:'escolaA',ativo:true}
];
test('busca é insensível a acentos, letras maiúsculas e espaços',()=>{
 assert.equal(normalizarBuscaAluno('  JOÃO  da SILVA  '),'joao da silva');
 assert.deepEqual(buscarAlunosDisponiveis(alunos,'escolaA','maria cecilia').alunos.map(a=>a.id),['2']);
 assert.deepEqual(buscarAlunosDisponiveis(alunos,'escolaA','JOAO').alunos.map(a=>a.id),['1','5']);
});
test('busca por matrícula retorna cadastro correto',()=>{
 assert.deepEqual(buscarAlunosDisponiveis(alunos,'escolaA','mat002').alunos.map(a=>a.id),['2']);
});
test('não mistura escolas nem permite selecionar alunos inativos',()=>{
 assert.equal(buscarAlunosDisponiveis(alunos,'escolaA','Ana').total,0);
 assert.equal(buscarAlunosDisponiveis(alunos,'escolaA','José').total,0);
 assert.equal(buscarAlunosDisponiveis(alunos,'','João').total,0);
});
test('limita resultados para apresentação sem perder total',()=>{
 const r=buscarAlunosDisponiveis(alunos,'escolaA','',1);
 assert.equal(r.total,3);
 assert.equal(r.alunos.length,1);
});
const source=readFileSync(new URL('../assets/js/app.js',import.meta.url),'utf8');
test('formulários de agendamento e consulta avulsa exigem seleção de aluno pesquisado',()=>{
 assert.match(source,/function seletorAlunoPesquisavel\(\)/);
 assert.match(source,/function ativarBuscaAlunosDoFormulario\(\)/);
 assert.match(source,/formularioNovoAgendamento\(\)/);
 assert.match(source,/schoolSelect\(\)\+seletorAlunoPesquisavel\(\)/);
 assert.match(source,/if\(!d\.aluno_id\)throw Error\('Pesquise e selecione um aluno cadastrado/);
 assert.match(source,/student\.escola_id!==d\.escola_id/);
 assert.match(source,/busca\.addEventListener\('input',\(\)=>\{resetar\(\);atualizar\(\);\}\)/);
});
