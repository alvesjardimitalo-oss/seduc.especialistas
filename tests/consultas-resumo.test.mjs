import test from 'node:test';
import assert from 'node:assert/strict';
import {resumirAluno,agruparConsultasPorAluno} from '../assets/js/consultas-resumo.mjs';
import {montarDocumentoAluno,montarDocumentoGerencial} from '../assets/js/relatorios-impressao.mjs';

const alunos=[{id:'a1',nome:'Aluno fictício A',escola_id:'e1'},{id:'a2',nome:'Aluno fictício B',escola_id:'e1'}];
const consultas=[
 {id:'c1',aluno_id:'a1',escola_id:'e1',status:'realizado',especialidade:'Psicopedagogia',autor_nome:'Profissional 1',evolucao_observada:'avanco_observado',data:new Date('2026-10-14T12:00:00Z'),texto:'Observação fictícia'},
 {id:'c2',aluno_id:'a1',escola_id:'e1',status:'realizado',especialidade:'Psicopedagogia',autor_nome:'Profissional 1',evolucao_observada:'nao_avaliada',data:new Date('2026-10-20T12:00:00Z'),texto:'Observação fictícia'}
];
const agenda=[{id:'g1',aluno_id:'a1',escola_id:'e1',status:'falta_aluno',inicio:new Date('2026-10-16T12:00:00Z')},{id:'g2',aluno_id:'a1',escola_id:'e1',status:'agendado',inicio:new Date('2026-11-01T12:00:00Z')}];

test('resumo não inventa evolução nem mistura alunos',()=>{
 const r=resumirAluno('a1',consultas,agenda,[]);
 assert.equal(r.consultas,2);
 assert.equal(r.faltasAluno,1);
 assert.equal(r.agendados,1);
 assert.equal(r.evolucao.avancos,1);
 assert.equal(r.evolucao.avaliacoes,1);
 const outro=resumirAluno('a2',consultas,agenda,[]);
 assert.equal(outro.consultas,0);
 assert.equal(outro.evolucao.avaliacoes,0);
 assert.match(outro.evolucao.descricao,/Sem evolução documentada/);
});
test('histórico agrupa por aluno e ordena consultas',()=>{
 const grupos=agruparConsultasPorAluno(consultas,alunos,agenda,[]);
 assert.equal(grupos.length,1);
 assert.equal(grupos[0].consultas[0].id,'c2');
 assert.equal(grupos[0].resumo.faltasAluno,1);
});
test('impressão individual é escapada e não expõe notas sem autorização',()=>{
 const doc=montarDocumentoAluno({aluno:{id:'a1',nome:'Aluno <fictício>',escola_id:'e1'},atendimentos:consultas,agendamentos:agenda,emissor:'Profissional',escola:'Escola',incluirNotas:false});
 assert.match(doc,/SECRETARIA MUNICIPAL DE EDUCAÇÃO/);
 assert.match(doc,/Aluno &lt;fictício&gt;/);
 assert.doesNotMatch(doc,/Observação fictícia/);
 assert.match(doc,/@page/);
});
test('relatório gerencial apresenta tabelas sem descrições privadas',()=>{
 const doc=montarDocumentoGerencial({atendimentos:consultas,agendamentos:agenda,escolas:[{id:'e1',nome:'Escola fictícia'}],emissor:'Gestão'});
 assert.match(doc,/Produção por especialidade/);
 assert.match(doc,/Escola fictícia/);
 assert.doesNotMatch(doc,/Observação fictícia/);
});
