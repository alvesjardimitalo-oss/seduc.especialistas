// Testes das regras de segurança no emulador do Firestore (dados fictícios).
// Executar: npm run test:regras   (requer Java 21+)
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, collection, query, where, serverTimestamp, Timestamp } from 'firebase/firestore';
import { instante, somarDias, diaMunicipal, diaDaSemana, prepararJornada, numeroDoDia } from '../js/dominio.js';
import assert from 'node:assert/strict';

let env;
const ESC_A = 'monteiro-lobato', ESC_B = 'prefeito-jose-pedro';
// Próxima terça-feira (municipal) para agendamentos futuros
let terca = somarDias(diaMunicipal(Date.now()), 1);
while (diaDaSemana(terca) !== 2) terca = somarDias(terca, 1);
const T = h => Timestamp.fromDate(instante(terca, h));
const jornadaFono = prepararJornada([{ dia: 2, inicio: '08:00', fim: '11:00', escola_id: ESC_A }]);

const usuarios = {
  admin: { nome: 'Admin', email: 'admin@teste.br', perfil: 'superadmin', ativo: true },
  sec: { nome: 'Secretaria', email: 'sec@teste.br', perfil: 'secretaria', ativo: true, gerenciar: true },
  secLeitura: { nome: 'Sec Leitura', email: 'sec2@teste.br', perfil: 'secretaria', ativo: true, gerenciar: false },
  dirA: { nome: 'Direção A', email: 'dira@teste.br', perfil: 'direcao', ativo: true, escolas: [ESC_A] },
  fono: { nome: 'Fono', email: 'fono@teste.br', perfil: 'especialista', ativo: true, especialidade: 'fonoaudiologia', ...jornadaFono },
  psico: { nome: 'Psicopedagoga', email: 'psico@teste.br', perfil: 'especialista', ativo: true, especialidade: 'psicopedagogia', jornada: [], slots: [] },
  inativa: { nome: 'Inativa', email: 'inativa@teste.br', perfil: 'especialista', ativo: false, especialidade: 'neuropsicologia' },
  pend: { nome: 'Pendente', email: 'pend@teste.br', perfil: 'pendente', ativo: false }
};
const db = uid => env.authenticatedContext(uid, { email: (usuarios[uid]?.email || uid + '@teste.br'), email_verified: true }).firestore();

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-seduc', firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c => {
    const f = c.firestore();
    for (const [uid, u] of Object.entries(usuarios)) await setDoc(doc(f, 'usuarios', uid), u);
    await setDoc(doc(f, 'escolas', ESC_A), { nome: 'EM Monteiro Lobato', tipo: 'escola' });
    await setDoc(doc(f, 'escolas', ESC_B), { nome: 'EM Prefeito José Pedro', tipo: 'escola' });
    await setDoc(doc(f, 'estudantes', 'alunoA'), { nome: 'Aluno A', escola_id: ESC_A, situacao: 'ativo', criado_por: 'fono', criado_em: Timestamp.now() });
    await setDoc(doc(f, 'estudantes', 'alunoB'), { nome: 'Aluno B', escola_id: ESC_B, situacao: 'ativo', criado_por: 'fono', criado_em: Timestamp.now() });
    await setDoc(doc(f, 'estudantes_clinico', 'alunoA'), { necessidade_informada: 'TEA' });
  });
});

// ---------- helpers ----------
const COD_AG = 'C261103-AG01';
function loteAtendimento(f, uid, { id = 'at1', aluno = 'alunoA', escola = ESC_A, esp = 'fonoaudiologia', ag = '', codigo = ag ? COD_AG : 'C261103-AT01', texto = 'Consciência fonológica' } = {}) {
  const b = writeBatch(f);
  b.set(doc(f, 'atendimentos', id), { estudante_id: aluno, escola_id: escola, profissional_uid: uid, profissional_nome: 'X', especialidade: esp, tipo: 'sessao', evolucao: 'avancou', data: Timestamp.now(), duracao_min: 45, agendamento_id: ag, codigo, situacao: 'valido', versao: 1, criado_em: serverTimestamp(), atualizado_em: serverTimestamp() });
  b.set(doc(f, 'atendimentos_registro', id), { estudante_id: aluno, profissional_uid: uid, trabalhado: texto, desenvolvido: 'Boa resposta', orientacoes: '', versao: 1 });
  return b;
}
function loteAgenda(f, { id = 'ag1', criador, prof = 'fono', aluno = 'alunoA', escola = ESC_A, hora = '09:00', dur = 30, esp = 'fonoaudiologia' } = {}) {
  const b = writeBatch(f), ini = instante(terca, hora);
  b.set(doc(f, 'agendamentos', id), { estudante_id: aluno, escola_id: escola, profissional_uid: prof, profissional_nome: 'Fono', especialidade: esp, inicio: Timestamp.fromDate(ini), duracao_min: dur, status: 'agendado', codigo: COD_AG, criado_por: criador, criado_em: serverTimestamp() });
  const partes = dur === 60 ? [ini.getTime(), ini.getTime() + 1800000] : [ini.getTime()];
  for (const t of partes) b.set(doc(f, 'reservas', prof + '_' + t), { agendamento_id: id, profissional_uid: prof, inicio: Timestamp.fromMillis(t) });
  return b;
}

// ---------- contas ----------
test('primeiro login cria conta pendente e não se autopromove', async () => {
  const f = env.authenticatedContext('novo', { email: 'novo@teste.br', email_verified: true }).firestore();
  await assertFails(setDoc(doc(f, 'usuarios', 'novo'), { nome: 'Novo', email: 'novo@teste.br', perfil: 'superadmin', ativo: true, criado_em: serverTimestamp() }));
  await assertFails(setDoc(doc(f, 'usuarios', 'novo'), { nome: 'Novo', email: 'novo@teste.br', perfil: 'especialista', ativo: true, especialidade: 'fonoaudiologia', escolas: [], criado_em: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(f, 'usuarios', 'novo'), { nome: 'Novo', email: 'novo@teste.br', perfil: 'pendente', ativo: false, criado_em: serverTimestamp() }));
  await assertFails(getDoc(doc(f, 'estudantes', 'alunoA')));
});

test('convite por e-mail libera a especialista no primeiro login', async () => {
  await assertSucceeds(setDoc(doc(db('sec'), 'convites', 'nova@teste.br'), { email: 'nova@teste.br', nome: 'Nova', perfil: 'especialista', especialidade: 'neuropsicologia', escolas: [], ativo: true, criado_por: 'sec', criado_em: serverTimestamp() }));
  await assertFails(setDoc(doc(db('sec'), 'convites', 'outra@teste.br'), { email: 'outra@teste.br', nome: 'X', perfil: 'secretaria', especialidade: '', escolas: [], ativo: true, criado_por: 'sec', criado_em: serverTimestamp() }));
  const f = env.authenticatedContext('nova', { email: 'nova@teste.br', email_verified: true }).firestore();
  await assertFails(setDoc(doc(f, 'usuarios', 'nova'), { nome: 'Nova', email: 'nova@teste.br', perfil: 'especialista', ativo: true, especialidade: 'fonoaudiologia', escolas: [], criado_em: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(f, 'usuarios', 'nova'), { nome: 'Nova', email: 'nova@teste.br', perfil: 'especialista', ativo: true, especialidade: 'neuropsicologia', escolas: [], criado_em: serverTimestamp() }));
});

test('secretaria delegada libera contas, mas não escala privilégios', async () => {
  const f = db('sec'), up = d => ({ ...d, atualizado_em: serverTimestamp(), atualizado_por: 'sec' });
  await assertSucceeds(updateDoc(doc(f, 'usuarios', 'pend'), up({ perfil: 'especialista', ativo: true, especialidade: 'neuropsicologia' })));
  await assertFails(updateDoc(doc(f, 'usuarios', 'psico'), up({ perfil: 'superadmin' })));
  await assertFails(updateDoc(doc(f, 'usuarios', 'admin'), up({ ativo: false })));
  await assertFails(updateDoc(doc(f, 'usuarios', 'secLeitura'), up({ gerenciar: true })));
  await assertFails(updateDoc(doc(f, 'usuarios', 'sec'), up({ nome: 'Eu mesma' })));
  await assertFails(updateDoc(doc(db('secLeitura'), 'usuarios', 'pend'), { perfil: 'especialista', ativo: true, especialidade: 'neuropsicologia', atualizado_em: serverTimestamp(), atualizado_por: 'secLeitura' }));
  await assertFails(updateDoc(doc(db('fono'), 'usuarios', 'fono'), { slots: [1, 2, 3], atualizado_em: serverTimestamp(), atualizado_por: 'fono' }));
  await assertSucceeds(updateDoc(doc(db('admin'), 'usuarios', 'sec'), { gerenciar: false, atualizado_em: serverTimestamp(), atualizado_por: 'admin' }));
});

test('conta inativa não lê nada', async () => {
  await assertFails(getDoc(doc(db('inativa'), 'estudantes', 'alunoA')));
  await assertFails(getDocs(collection(db('inativa'), 'escolas')));
});

// ---------- alunos ----------
test('equipe vê todas as escolas; direção só a própria', async () => {
  await assertSucceeds(getDocs(collection(db('psico'), 'estudantes')));
  await assertSucceeds(getDoc(doc(db('dirA'), 'estudantes', 'alunoA')));
  await assertFails(getDoc(doc(db('dirA'), 'estudantes', 'alunoB')));
  await assertFails(getDocs(collection(db('dirA'), 'estudantes')));
  await assertSucceeds(getDocs(query(collection(db('dirA'), 'estudantes'), where('escola_id', 'in', [ESC_A]))));
});

test('cadastro de aluno: direção na própria escola; dados clínicos só equipe', async () => {
  const novo = (uid, escola) => ({ nome: 'Novo Aluno', escola_id: escola, situacao: 'ativo', criado_por: uid, criado_em: serverTimestamp() });
  await assertSucceeds(setDoc(doc(db('dirA'), 'estudantes', 'n1'), novo('dirA', ESC_A)));
  await assertFails(setDoc(doc(db('dirA'), 'estudantes', 'n2'), novo('dirA', ESC_B)));
  await assertSucceeds(setDoc(doc(db('psico'), 'estudantes', 'n3'), novo('psico', ESC_B)));
  await assertFails(setDoc(doc(db('secLeitura'), 'estudantes', 'n4'), novo('secLeitura', ESC_B)));
  await assertFails(deleteDoc(doc(db('admin'), 'estudantes', 'alunoA')));
  await assertSucceeds(getDoc(doc(db('psico'), 'estudantes_clinico', 'alunoA')));
  await assertFails(getDoc(doc(db('dirA'), 'estudantes_clinico', 'alunoA')));
  await assertFails(getDoc(doc(db('sec'), 'estudantes_clinico', 'alunoA')));
});

// ---------- prontuário ----------
test('especialista registra atendimento na própria especialidade', async () => {
  await assertSucceeds(loteAtendimento(db('fono'), 'fono').commit());
  await assertFails(loteAtendimento(db('fono'), 'fono', { id: 'at2', esp: 'psicopedagogia' }).commit());
  await assertFails(loteAtendimento(db('fono'), 'psico', { id: 'at3', esp: 'psicopedagogia' }).commit());
  await assertFails(loteAtendimento(db('fono'), 'fono', { id: 'at4', escola: ESC_B }).commit()); // escola diferente da do aluno
  await assertFails(loteAtendimento(db('dirA'), 'dirA', { id: 'at5' }).commit());
  await assertFails(loteAtendimento(db('admin'), 'admin', { id: 'at6' }).commit());
});

test('prontuário compartilhado: equipe lê, gestão e direção só metadados', async () => {
  await loteAtendimento(db('fono'), 'fono').commit();
  await assertSucceeds(getDoc(doc(db('psico'), 'atendimentos_registro', 'at1')));
  await assertSucceeds(getDocs(query(collection(db('psico'), 'atendimentos_registro'), where('estudante_id', '==', 'alunoA'))));
  await assertSucceeds(getDoc(doc(db('admin'), 'atendimentos_registro', 'at1')));
  await assertFails(getDoc(doc(db('sec'), 'atendimentos_registro', 'at1')));
  await assertFails(getDoc(doc(db('dirA'), 'atendimentos_registro', 'at1')));
  await assertSucceeds(getDoc(doc(db('sec'), 'atendimentos', 'at1')));
  await assertSucceeds(getDoc(doc(db('dirA'), 'atendimentos', 'at1')));
});

test('retificação só pela autora, com versão imutável; nada é apagado', async () => {
  await loteAtendimento(db('fono'), 'fono').commit();
  const f = db('fono');
  const atual = (await getDoc(doc(f, 'atendimentos', 'at1'))).data(), reg = (await getDoc(doc(f, 'atendimentos_registro', 'at1'))).data();
  // sem versão: recusado
  await assertFails(updateDoc(doc(f, 'atendimentos_registro', 'at1'), { trabalhado: 'Alterado', versao: 2 }));
  const ret = (ff, autor) => {
    const b = writeBatch(ff);
    b.set(doc(ff, 'atendimentos_versoes', 'at1_1'), { atendimento_id: 'at1', versao: 1, autor_uid: autor, em: serverTimestamp(), motivo: 'Correção de digitação', atendimento: atual, registro: reg });
    b.update(doc(ff, 'atendimentos', 'at1'), { evolucao: 'estavel', versao: 2, atualizado_em: serverTimestamp() });
    b.update(doc(ff, 'atendimentos_registro', 'at1'), { trabalhado: 'Alterado', versao: 2 });
    return b.commit();
  };
  await assertFails(ret(db('psico'), 'psico'));
  await assertSucceeds(ret(f, 'fono'));
  await assertFails(updateDoc(doc(f, 'atendimentos_versoes', 'at1_1'), { motivo: 'outro' }));
  await assertFails(deleteDoc(doc(f, 'atendimentos', 'at1')));
  await assertFails(deleteDoc(doc(f, 'atendimentos_registro', 'at1')));
  // versão com conteúdo falso é recusada
  const atual2 = (await getDoc(doc(f, 'atendimentos', 'at1'))).data();
  const b = writeBatch(f);
  b.set(doc(f, 'atendimentos_versoes', 'at1_2'), { atendimento_id: 'at1', versao: 2, autor_uid: 'fono', em: serverTimestamp(), motivo: 'x', atendimento: { ...atual2, tipo: 'alta' }, registro: { ...reg, trabalhado: 'Alterado', versao: 2 } });
  b.update(doc(f, 'atendimentos', 'at1'), { evolucao: 'regrediu', versao: 3, atualizado_em: serverTimestamp() });
  await assertFails(b.commit());
});

test('anulação: autora ou administração, com motivo', async () => {
  await loteAtendimento(db('fono'), 'fono').commit();
  const anular = async (uid) => {
    const f = db(uid);
    let atual, reg;
    await env.withSecurityRulesDisabled(async c => {
      atual = (await getDoc(doc(c.firestore(), 'atendimentos', 'at1'))).data();
      reg = (await getDoc(doc(c.firestore(), 'atendimentos_registro', 'at1'))).data();
    });
    const b = writeBatch(f);
    b.set(doc(f, 'atendimentos_versoes', 'at1_' + atual.versao), { atendimento_id: 'at1', versao: atual.versao, autor_uid: uid, em: serverTimestamp(), motivo: 'Aluno errado', atendimento: atual, registro: reg });
    b.update(doc(f, 'atendimentos', 'at1'), { situacao: 'anulado', motivo_anulacao: 'Aluno errado', anulado_por: uid, versao: atual.versao + 1, atualizado_em: serverTimestamp() });
    return b.commit();
  };
  await assertFails(anular('psico'));
  await assertFails(anular('sec'));
  await assertSucceeds(anular('admin'));
});

// ---------- agenda ----------
test('agendamento dentro da jornada com reserva atômica', async () => {
  await assertSucceeds(loteAgenda(db('fono'), { criador: 'fono' }).commit());
  // mesmo horário: conflito
  await assertFails(loteAgenda(db('sec'), { id: 'ag2', criador: 'sec' }).commit());
  // fora da jornada (11:00)
  await assertFails(loteAgenda(db('sec'), { id: 'ag3', criador: 'sec', hora: '11:00' }).commit());
  // 60 min terminando fora da jornada (10:30-11:30)
  await assertFails(loteAgenda(db('sec'), { id: 'ag4', criador: 'sec', hora: '10:30', dur: 60 }).commit());
  await assertSucceeds(loteAgenda(db('sec'), { id: 'ag5', criador: 'sec', hora: '10:00', dur: 60 }).commit());
  // sem reserva
  await assertFails(setDoc(doc(db('sec'), 'agendamentos', 'ag6'), { estudante_id: 'alunoA', escola_id: ESC_A, profissional_uid: 'fono', profissional_nome: 'Fono', especialidade: 'fonoaudiologia', inicio: T('08:00'), duracao_min: 30, status: 'agendado', codigo: COD_AG, criado_por: 'sec', criado_em: serverTimestamp() }));
  // especialidade não confere
  await assertFails(loteAgenda(db('sec'), { id: 'ag7', criador: 'sec', hora: '08:00', esp: 'psicopedagogia' }).commit());
  // profissional sem jornada
  await assertFails(loteAgenda(db('sec'), { id: 'ag8', criador: 'sec', prof: 'psico', esp: 'psicopedagogia' }).commit());
  // especialista não agenda em nome de outra
  await assertFails(loteAgenda(db('psico'), { id: 'ag9', criador: 'psico', hora: '08:00' }).commit());
});

test('direção agenda apenas alunos da própria escola', async () => {
  await assertSucceeds(loteAgenda(db('dirA'), { criador: 'dirA', hora: '08:00' }).commit());
  await assertFails(loteAgenda(db('dirA'), { id: 'ag2', criador: 'dirA', hora: '08:30', aluno: 'alunoB', escola: ESC_B }).commit());
});

test('cancelamento libera o horário para novo agendamento', async () => {
  await loteAgenda(db('fono'), { criador: 'fono' }).commit();
  const ini = instante(terca, '09:00').getTime(), f = db('dirA');
  const semReserva = writeBatch(f);
  semReserva.update(doc(f, 'agendamentos', 'ag1'), { status: 'cancelado', motivo: 'Aluno doente', alterado_por: 'dirA', alterado_em: serverTimestamp() });
  await assertFails(semReserva.commit());
  const b = writeBatch(f);
  b.update(doc(f, 'agendamentos', 'ag1'), { status: 'cancelado', motivo: 'Aluno doente', alterado_por: 'dirA', alterado_em: serverTimestamp() });
  b.delete(doc(f, 'reservas', 'fono_' + ini));
  await assertSucceeds(b.commit());
  await assertSucceeds(loteAgenda(db('fono'), { id: 'ag2', criador: 'fono' }).commit());
  // reserva de agendamento ativo não pode ser apagada avulsa
  await assertFails(deleteDoc(doc(db('admin'), 'reservas', 'fono_' + ini)));
});

test('falta só depois do horário; realizado só com o registro da profissional', async () => {
  await loteAgenda(db('fono'), { criador: 'fono' }).commit();
  await assertFails(updateDoc(doc(db('fono'), 'agendamentos', 'ag1'), { status: 'falta', motivo: '', alterado_por: 'fono', alterado_em: serverTimestamp() }));
  await assertFails(updateDoc(doc(db('fono'), 'agendamentos', 'ag1'), { status: 'realizado', atendimento_id: 'x', alterado_por: 'fono', alterado_em: serverTimestamp() }));
  const f = db('fono'), b = loteAtendimento(f, 'fono', { id: 'at9', ag: 'ag1' });
  b.update(doc(f, 'agendamentos', 'ag1'), { status: 'realizado', atendimento_id: 'at9', alterado_por: 'fono', alterado_em: serverTimestamp() });
  await assertSucceeds(b.commit());
  // agendamento passado: falta permitida
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'agendamentos', 'agP'), { estudante_id: 'alunoA', escola_id: ESC_A, profissional_uid: 'fono', profissional_nome: 'Fono', especialidade: 'fonoaudiologia', inicio: Timestamp.fromMillis(Date.now() - 3600000), duracao_min: 30, status: 'agendado', criado_por: 'fono', criado_em: Timestamp.now() }));
  await assertFails(updateDoc(doc(db('dirA'), 'agendamentos', 'agP'), { status: 'falta', motivo: '', alterado_por: 'dirA', alterado_em: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(db('fono'), 'agendamentos', 'agP'), { status: 'falta', motivo: 'Não compareceu', alterado_por: 'fono', alterado_em: serverTimestamp() }));
});

// ---------- relatórios ----------
test('relatórios descritivos são da equipe e imutáveis', async () => {
  const r = { estudante_id: 'alunoA', escola_id: ESC_A, profissional_uid: 'fono', profissional_nome: 'Fono', especialidade: 'fonoaudiologia', registro_profissional: 'CRFa 6-0000', tipo: 'relatorio', titulo: 'Relatório', destinatario: 'Família', periodo_de: '2026-01-01', periodo_ate: '2026-06-30', texto: 'Texto', criado_em: serverTimestamp() };
  await assertSucceeds(setDoc(doc(db('fono'), 'relatorios', 'r1'), r));
  await assertFails(setDoc(doc(db('fono'), 'relatorios', 'r2'), { ...r, especialidade: 'neuropsicologia' }));
  await assertFails(updateDoc(doc(db('fono'), 'relatorios', 'r1'), { texto: 'Mudado' }));
  await assertSucceeds(getDoc(doc(db('psico'), 'relatorios', 'r1')));
  await assertFails(getDoc(doc(db('dirA'), 'relatorios', 'r1')));
});

// ---------- exclusão de usuários ----------
const atualizacao = (por, d) => ({ ...d, atualizado_em: serverTimestamp(), atualizado_por: por });

test('excluir acesso: gestão bloqueia a conta, que deixa de ler; restaurar devolve', async () => {
  await assertSucceeds(updateDoc(doc(db('sec'), 'usuarios', 'psico'), atualizacao('sec', { ativo: false, excluido: true, motivo_exclusao: 'Fim do contrato', excluido_em: serverTimestamp() })));
  await assertFails(getDoc(doc(db('psico'), 'estudantes', 'alunoA')));
  await assertFails(loteAtendimento(db('psico'), 'psico', { id: 'atX', esp: 'psicopedagogia' }).commit());
  await assertSucceeds(updateDoc(doc(db('sec'), 'usuarios', 'psico'), atualizacao('sec', { ativo: true, excluido: false, motivo_exclusao: '' })));
  await assertSucceeds(getDoc(doc(db('psico'), 'estudantes', 'alunoA')));
});

test('excluir acesso: sem autoexclusão, sem excluir administrador, sem apagar quem já teve acesso', async () => {
  await assertFails(updateDoc(doc(db('admin'), 'usuarios', 'admin'), atualizacao('admin', { excluido: true })));
  await assertFails(updateDoc(doc(db('sec'), 'usuarios', 'admin'), atualizacao('sec', { ativo: false, excluido: true })));
  await assertFails(updateDoc(doc(db('fono'), 'usuarios', 'psico'), atualizacao('fono', { ativo: false, excluido: true })));
  await assertFails(deleteDoc(doc(db('admin'), 'usuarios', 'fono')));
  await assertFails(deleteDoc(doc(db('secLeitura'), 'usuarios', 'pend')));
  await assertSucceeds(deleteDoc(doc(db('sec'), 'usuarios', 'pend')));
});

test('atendimentos de profissional excluída continuam no prontuário', async () => {
  await loteAtendimento(db('fono'), 'fono').commit();
  await updateDoc(doc(db('admin'), 'usuarios', 'fono'), atualizacao('admin', { ativo: false, excluido: true, motivo_exclusao: 'Saiu' }));
  await assertSucceeds(getDoc(doc(db('psico'), 'atendimentos_registro', 'at1')));
  await assertFails(deleteDoc(doc(db('admin'), 'atendimentos', 'at1')));
  // e não pode mais receber agendamentos
  await assertFails(loteAgenda(db('sec'), { criador: 'sec' }).commit());
});

test('conta criada na versão antiga pode ser regravada só com os campos válidos', async () => {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), 'usuarios', 'antiga'), { nome: 'Antiga', email: 'antiga@teste.br', perfil: 'especialista', ativo: true, especialidade: 'fonoaudiologia', vinculos_legados: ['x'], termos_aceitos: true, criado_em: Timestamp.fromMillis(1) }));
  await assertFails(updateDoc(doc(db('admin'), 'usuarios', 'antiga'), atualizacao('admin', { nome: 'Antiga Editada' })));
  await assertSucceeds(setDoc(doc(db('admin'), 'usuarios', 'antiga'), atualizacao('admin', { nome: 'Antiga Editada', email: 'antiga@teste.br', perfil: 'especialista', ativo: true, especialidade: 'fonoaudiologia', criado_em: Timestamp.fromMillis(1), jornada: [], slots: [] })));
  // trocar o e-mail não é permitido
  await assertFails(setDoc(doc(db('admin'), 'usuarios', 'antiga'), atualizacao('admin', { nome: 'Antiga', email: 'outro@teste.br', perfil: 'especialista', ativo: true, especialidade: 'fonoaudiologia', criado_em: Timestamp.fromMillis(1) })));
});

// ---------- fluxo completo de um atendimento ----------
test('fluxo: encaminhar → agendar → remarcar → realizar → retificar → alta', async () => {
  // direção cadastra o aluno com o motivo do encaminhamento
  const dir = db('dirA'), b0 = writeBatch(dir);
  b0.set(doc(dir, 'estudantes', 'novo'), { nome: 'Criança Encaminhada', escola_id: ESC_A, situacao: 'ativo', criado_por: 'dirA', criado_em: serverTimestamp() });
  b0.set(doc(dir, 'estudantes_privado', 'novo'), { responsavel: 'Mãe', motivo_encaminhamento: 'Não reconhece letras', atualizado_por: 'dirA', atualizado_em: serverTimestamp() });
  await assertSucceeds(b0.commit());
  // direção agenda nos horários livres da fono
  await assertSucceeds(loteAgenda(dir, { id: 'ag1', criador: 'dirA', aluno: 'novo', hora: '08:00' }).commit());
  // remarcação: novo horário primeiro, depois cancela o antigo
  await assertSucceeds(loteAgenda(db('fono'), { id: 'ag2', criador: 'fono', aluno: 'novo', hora: '09:30' }).commit());
  const f = db('fono'), bc = writeBatch(f);
  bc.update(doc(f, 'agendamentos', 'ag1'), { status: 'cancelado', motivo: 'Remarcado', alterado_por: 'fono', alterado_em: serverTimestamp() });
  bc.delete(doc(f, 'reservas', 'fono_' + instante(terca, '08:00').getTime()));
  await assertSucceeds(bc.commit());
  // a fono registra o atendimento do agendamento (avaliação), que vira "realizado"
  const br = loteAtendimento(f, 'fono', { id: 'av1', aluno: 'novo', ag: 'ag2' });
  br.update(doc(f, 'agendamentos', 'ag2'), { status: 'realizado', atendimento_id: 'av1', alterado_por: 'fono', alterado_em: serverTimestamp() });
  await assertSucceeds(br.commit());
  // não pode registrar duas vezes o mesmo agendamento
  const bdup = loteAtendimento(f, 'fono', { id: 'av2', aluno: 'novo', ag: 'ag2' });
  bdup.update(doc(f, 'agendamentos', 'ag2'), { status: 'realizado', atendimento_id: 'av2', alterado_por: 'fono', alterado_em: serverTimestamp() });
  await assertFails(bdup.commit());
  // outra especialista lê, a direção vê só metadados
  await assertSucceeds(getDoc(doc(db('psico'), 'atendimentos_registro', 'av1')));
  await assertFails(getDoc(doc(dir, 'atendimentos_registro', 'av1')));
  await assertSucceeds(getDoc(doc(dir, 'atendimentos', 'av1')));
  // retificação da autora com versão
  const a1 = (await getDoc(doc(f, 'atendimentos', 'av1'))).data(), r1 = (await getDoc(doc(f, 'atendimentos_registro', 'av1'))).data();
  const bv = writeBatch(f);
  bv.set(doc(f, 'atendimentos_versoes', 'av1_1'), { atendimento_id: 'av1', versao: 1, autor_uid: 'fono', em: serverTimestamp(), motivo: 'Tipo correto é avaliação', atendimento: a1, registro: r1 });
  bv.update(doc(f, 'atendimentos', 'av1'), { tipo: 'avaliacao', versao: 2, atualizado_em: serverTimestamp() });
  bv.update(doc(f, 'atendimentos_registro', 'av1'), { trabalhado: 'Avaliação de linguagem oral', versao: 2 });
  await assertSucceeds(bv.commit());
  // alta registrada como novo atendimento avulso (sem agendamento)
  const ba = writeBatch(f);
  ba.set(doc(f, 'atendimentos', 'alta1'), { estudante_id: 'novo', escola_id: ESC_A, profissional_uid: 'fono', profissional_nome: 'Fono', especialidade: 'fonoaudiologia', tipo: 'alta', evolucao: 'avancou', data: Timestamp.now(), duracao_min: 30, agendamento_id: '', codigo: 'C261103-AL01', situacao: 'valido', versao: 1, criado_em: serverTimestamp(), atualizado_em: serverTimestamp() });
  ba.set(doc(f, 'atendimentos_registro', 'alta1'), { estudante_id: 'novo', profissional_uid: 'fono', trabalhado: 'Objetivos atingidos', versao: 1 });
  await assertSucceeds(ba.commit());
  // atendimento no futuro é recusado
  const bfut = writeBatch(f);
  bfut.set(doc(f, 'atendimentos', 'fut'), { estudante_id: 'novo', escola_id: ESC_A, profissional_uid: 'fono', profissional_nome: 'Fono', especialidade: 'fonoaudiologia', tipo: 'sessao', evolucao: 'avancou', data: Timestamp.fromMillis(Date.now() + 86400000), duracao_min: 30, agendamento_id: '', codigo: 'C261103-AL01', situacao: 'valido', versao: 1, criado_em: serverTimestamp(), atualizado_em: serverTimestamp() });
  bfut.set(doc(f, 'atendimentos_registro', 'fut'), { estudante_id: 'novo', profissional_uid: 'fono', trabalhado: 'x', versao: 1 });
  await assertFails(bfut.commit());
  // aluno arquivado não recebe novos atendimentos, mas o prontuário continua legível
  await updateDoc(doc(db('admin'), 'estudantes', 'novo'), { situacao: 'arquivado', motivo_arquivamento: 'Transferido', atualizado_por: 'admin', atualizado_em: serverTimestamp() });
  await assertFails(loteAtendimento(f, 'fono', { id: 'av3', aluno: 'novo' }).commit());
  await assertSucceeds(getDoc(doc(db('psico'), 'atendimentos_registro', 'av1')));
});

// ---------- v2.1: login com senha, criação de contas, termo LGPD, 500 caracteres, código ----------
const ctx = (uid, token) => env.authenticatedContext(uid, token).firestore();

test('login por e-mail e senha vale; Google sem e-mail verificado não', async () => {
  await assertSucceeds(getDoc(doc(ctx('fono', { email: 'fono@teste.br', email_verified: false, firebase: { sign_in_provider: 'password' } }), 'estudantes', 'alunoA')));
  await assertFails(getDoc(doc(ctx('fono', { email: 'fono@teste.br', email_verified: false, firebase: { sign_in_provider: 'google.com' } }), 'estudantes', 'alunoA')));
});

test('convite só é usado por e-mail verificado (senha criada por terceiros não reivindica convite)', async () => {
  await setDoc(doc(db('sec'), 'convites', 'alvo@teste.br'), { email: 'alvo@teste.br', nome: 'Alvo', perfil: 'especialista', especialidade: 'neuropsicologia', escolas: [], ativo: true, criado_por: 'sec', criado_em: serverTimestamp() });
  const intruso = ctx('intruso', { email: 'alvo@teste.br', email_verified: false, firebase: { sign_in_provider: 'password' } });
  await assertFails(setDoc(doc(intruso, 'usuarios', 'intruso'), { nome: 'X', email: 'alvo@teste.br', perfil: 'especialista', ativo: true, especialidade: 'neuropsicologia', escolas: [], criado_em: serverTimestamp() }));
  await assertSucceeds(setDoc(doc(intruso, 'usuarios', 'intruso'), { nome: 'X', email: 'alvo@teste.br', perfil: 'pendente', ativo: false, criado_em: serverTimestamp() }));
});

test('gestão cria a conta de quem recebe login e senha, sem conceder gerência', async () => {
  const conta = (extra = {}) => ({ nome: 'Joana', email: 'joana@teste.br', perfil: 'especialista', especialidade: 'fonoaudiologia', escolas: [ESC_A], jornada: [], slots: [], ativo: true, excluido: false, gerenciar: false, criado_em: serverTimestamp(), ...extra });
  await assertSucceeds(setDoc(doc(db('sec'), 'usuarios', 'joana'), conta()));
  await assertFails(setDoc(doc(db('secLeitura'), 'usuarios', 'joana2'), conta()));
  await assertFails(setDoc(doc(db('fono'), 'usuarios', 'joana3'), conta()));
  await assertFails(setDoc(doc(db('sec'), 'usuarios', 'joana4'), conta({ perfil: 'secretaria', especialidade: '' })));
  await assertFails(setDoc(doc(db('sec'), 'usuarios', 'joana5'), conta({ gerenciar: true })));
  await assertFails(setDoc(doc(db('admin'), 'usuarios', 'joana6'), conta({ perfil: 'superadmin', especialidade: '' })));
  await assertSucceeds(setDoc(doc(db('admin'), 'usuarios', 'joana7'), conta({ perfil: 'secretaria', especialidade: '' })));
});

test('termo LGPD: a pessoa registra o próprio aceite e nada mais', async () => {
  await assertSucceeds(updateDoc(doc(db('fono'), 'usuarios', 'fono'), { termo_lgpd: 'lgpd-2026-10', termo_lgpd_em: serverTimestamp() }));
  await assertFails(updateDoc(doc(db('fono'), 'usuarios', 'fono'), { termo_lgpd: 'lgpd-2026-11', termo_lgpd_em: serverTimestamp(), especialidade: 'neuropsicologia' }));
  await assertFails(updateDoc(doc(db('fono'), 'usuarios', 'psico'), { termo_lgpd: 'lgpd-2026-10', termo_lgpd_em: serverTimestamp() }));
  await assertFails(updateDoc(doc(db('inativa'), 'usuarios', 'inativa'), { termo_lgpd: 'lgpd-2026-10', termo_lgpd_em: serverTimestamp() }));
});

test('registro da consulta: até 500 caracteres no total', async () => {
  await assertSucceeds(loteAtendimento(db('fono'), 'fono', { id: 'c1', texto: 'x'.repeat(488) }).commit()); // + 'Boa resposta' (12) = 500
  await assertFails(loteAtendimento(db('fono'), 'fono', { id: 'c2', texto: 'x'.repeat(489) }).commit());
});

test('código único: obrigatório e igual ao do agendamento', async () => {
  await assertFails(loteAtendimento(db('fono'), 'fono', { id: 'k1', codigo: '' }).commit());
  await assertFails(loteAtendimento(db('fono'), 'fono', { id: 'k2', codigo: 'abc' }).commit());
  await loteAgenda(db('fono'), { criador: 'fono' }).commit();
  const f = db('fono');
  const errado = loteAtendimento(f, 'fono', { id: 'k3', ag: 'ag1', codigo: 'C261103-ZZZZ' });
  errado.update(doc(f, 'agendamentos', 'ag1'), { status: 'realizado', atendimento_id: 'k3', alterado_por: 'fono', alterado_em: serverTimestamp() });
  await assertFails(errado.commit());
  const certo = loteAtendimento(f, 'fono', { id: 'k4', ag: 'ag1' });
  certo.update(doc(f, 'agendamentos', 'ag1'), { status: 'realizado', atendimento_id: 'k4', alterado_por: 'fono', alterado_em: serverTimestamp() });
  await assertSucceeds(certo.commit());
});

// ---------- v2.2: adaptações escolares ----------
test('calendário escolar: só a gestão bloqueia; agendamento em dia bloqueado é recusado', async () => {
  const n = numeroDoDia(terca), bloq = (f, por, escola = '') => setDoc(doc(f, 'bloqueios', 'd' + n + (escola ? '_' + escola : '')), { dia: n, data: terca, escola_id: escola, motivo: 'Conselho de classe', criado_por: por, criado_em: serverTimestamp() });
  await assertFails(bloq(db('fono'), 'fono'));
  await assertFails(bloq(db('dirA'), 'dirA'));
  await assertFails(setDoc(doc(db('sec'), 'bloqueios', 'dqualquer'), { dia: n, data: terca, escola_id: '', motivo: 'X', criado_por: 'sec', criado_em: serverTimestamp() }));
  await assertSucceeds(bloq(db('sec'), 'sec', ESC_B));
  await assertSucceeds(loteAgenda(db('fono'), { criador: 'fono' }).commit()); // ESC_A não bloqueada
  await assertSucceeds(bloq(db('sec'), 'sec'));
  await assertFails(loteAgenda(db('fono'), { id: 'ag2', criador: 'fono', hora: '10:00' }).commit()); // rede toda bloqueada
  await assertSucceeds(getDoc(doc(db('fono'), 'bloqueios', 'd' + n)));
  await assertSucceeds(deleteDoc(doc(db('sec'), 'bloqueios', 'd' + n)));
  await assertSucceeds(loteAgenda(db('fono'), { id: 'ag3', criador: 'fono', hora: '10:00' }).commit());
});

test('orientação para a escola: a direção lê; tipos escolares aceitos', async () => {
  const f = db('fono'), b = writeBatch(f);
  b.set(doc(f, 'atendimentos', 'os1'), { estudante_id: 'alunoA', escola_id: ESC_A, profissional_uid: 'fono', profissional_nome: 'Fono', especialidade: 'fonoaudiologia', tipo: 'observacao_sala', evolucao: 'nao_avaliado', data: Timestamp.now(), duracao_min: 50, agendamento_id: '', codigo: 'C261103-OS01', orientacao_escola: 'Dar comandos curtos, um de cada vez.', situacao: 'valido', versao: 1, criado_em: serverTimestamp(), atualizado_em: serverTimestamp() });
  b.set(doc(f, 'atendimentos_registro', 'os1'), { estudante_id: 'alunoA', profissional_uid: 'fono', trabalhado: 'Observação da aluna na aula de português.', versao: 1 });
  await assertSucceeds(b.commit());
  const vista = await getDoc(doc(db('dirA'), 'atendimentos', 'os1'));
  assert.equal(vista.data().orientacao_escola, 'Dar comandos curtos, um de cada vez.');
  await assertFails(getDoc(doc(db('dirA'), 'atendimentos_registro', 'os1')));
});

test('apagar definitivamente: só a administração, só conta já excluída', async () => {
  await assertFails(deleteDoc(doc(db('admin'), 'usuarios', 'psico')));
  await updateDoc(doc(db('admin'), 'usuarios', 'psico'), { ativo: false, excluido: true, motivo_exclusao: 'Teste', atualizado_em: serverTimestamp(), atualizado_por: 'admin' });
  await assertFails(deleteDoc(doc(db('sec'), 'usuarios', 'psico')));
  await assertSucceeds(deleteDoc(doc(db('admin'), 'usuarios', 'psico')));
});
