import {test} from 'node:test';import assert from 'node:assert/strict';
import {filtrarAlunos,formatarNascimento,prepararMatricula} from '../assets/js/consultorio-aluno.mjs';
import {perfisAcompanhados} from '../assets/js/perfil-acompanhamento.mjs';
test('lista filtra por instituição e intervalo ou data exata de nascimento',()=>{
 const alunos=[{id:'a',nome:'João',escola_id:'e1',nascimento:'2018-04-01'},{id:'b',nome:'Ana',escola_id:'e2',nascimento:'2018-04-01'},{id:'c',nome:'José',escola_id:'e1',nascimento:''}];
 assert.equal(filtrarAlunos(alunos,{escola:'e1',nascimentoDe:'2018-04-01',nascimentoAte:'2018-04-01'})[0].id,'a');
 assert.equal(filtrarAlunos(alunos,{nome:'joao'}).length,1);assert.equal(filtrarAlunos(alunos,{escola:'e1'}).length,2);
 assert.throws(()=>filtrarAlunos(alunos,{nascimentoDe:'2020-01-01',nascimentoAte:'2010-01-01'}));
 assert.equal(formatarNascimento('2018-04-01'),'01/04/2018');
});
test('matrícula exige turma, turno, professor e ano letivo válidos',()=>{
 const d={numero:'M1',turma:'5º A',turno:'manha',professor:'Professora Fictícia',ano_letivo:'2026'};
 assert.equal(prepararMatricula(d).ano_letivo,2026);for(const invalido of [{turma:''},{turno:'invalid'},{professor:''},{ano_letivo:'2.5'}])assert.throws(()=>prepararMatricula({...d,...invalido}));
});
test('consultório do aluno reúne consultas de especialistas diferentes sem misturar alunos',()=>{
 const alunos=[{id:'a',nome:'Aluno A'},{id:'b',nome:'Aluno B'}];
 const consultas=[{id:'1',aluno_id:'a',autor_uid:'fono',status:'realizado'},{id:'2',aluno_id:'a',autor_uid:'psico',status:'realizado'},{id:'3',aluno_id:'b',autor_uid:'fono',status:'realizado'}];
 const g=perfisAcompanhados(alunos,consultas,[]);assert.deepEqual(new Set(g.find(g=>g.aluno.id==='a').consultas.map(r=>r.autor_uid)),new Set(['fono','psico']));assert.equal(g.find(g=>g.aluno.id==='b').consultas.length,1);
});
