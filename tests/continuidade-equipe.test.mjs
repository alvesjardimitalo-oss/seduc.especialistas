import {test} from 'node:test';import assert from 'node:assert/strict';
import {separarRegistroEquipe,montarContinuidade} from '../assets/js/continuidade-equipe.mjs';
test('referência separa atividades, resposta e próximos passos sem alterar o registro original',()=>{
 const texto='Motivo / objetivo:\nLeitura\n\nAtividades e procedimentos:\nJogo de palavras\n\nObservações e resposta:\nParticipação com apoio\n\nOrientações e encaminhamentos:\nRetomar a leitura na próxima sessão';
 const r=separarRegistroEquipe(texto);assert.equal(r.atividades,'Jogo de palavras');assert.equal(r.resposta,'Participação com apoio');assert.equal(r.proximosPassos,'Retomar a leitura na próxima sessão');assert.equal(r.integral,texto);
});
test('continuidade conserva toda a trajetória e destaca último registro de cada especialista',()=>{
 const registros=[{id:'a1',aluno_id:'aluno',autor_uid:'fono',status:'realizado',data:'2026-01-01',texto:'Anterior'},{id:'a2',aluno_id:'aluno',autor_uid:'psico',status:'realizado',data:'2026-01-02',texto:'Outro profissional'},{id:'a3',aluno_id:'aluno',autor_uid:'fono',status:'realizado',data:'2026-01-03',texto:'Mais recente'},{id:'cancelada',aluno_id:'aluno',autor_uid:'fono',status:'cancelado'},{id:'outro-aluno',aluno_id:'outro',autor_uid:'fono',status:'realizado'}];
 const c=montarContinuidade('aluno',registros);assert.equal(c.historico.length,3);assert.equal(c.profissionais,2);assert.deepEqual(c.ultimosPorProfissional.map(a=>a.id),['a3','a2']);assert.equal(c.historico[2].id,'a1');
});
test('anotações antigas em texto livre são preservadas sem inventar estrutura ou evolução',()=>{
 const r=separarRegistroEquipe('Anotação livre antiga.');assert.equal(r.integral,'Anotação livre antiga.');assert.equal(r.resposta,'');assert.equal(r.proximosPassos,'');
});
