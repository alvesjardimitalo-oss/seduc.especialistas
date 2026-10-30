// Acesso ao Firestore. Toda regra de permissão é reforçada em firestore.rules;
// aqui ficam as gravações atômicas (lotes e transações) que as regras exigem.
import {
  initializeApp, deleteApp, getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut,
  signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword,
  getFirestore, collection, doc, getDoc, getDocs, query, where, writeBatch, runTransaction, serverTimestamp, Timestamp
} from './firebase.js';
import { MEIA_HORA, ms, gerarCodigo } from './dominio.js';

let auth, db, configuracao;
const lista = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
const pedacos = (arr, n = 10) => { const r = []; for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i + n)); return r; };
const ts = d => Timestamp.fromDate(d instanceof Date ? d : new Date(ms(d)));

export function iniciar(config) {
  configuracao = config;
  const app = initializeApp(config);
  auth = getAuth(app); db = getFirestore(app);
}
export const entrar = () => signInWithPopup(auth, new GoogleAuthProvider());
export const entrarComSenha = (email, senha) => signInWithEmailAndPassword(auth, email.trim(), senha);
export const recuperarSenha = email => sendPasswordResetEmail(auth, email.trim());

const senhaAleatoria = () => { const b = new Uint8Array(24); crypto.getRandomValues(b); return Array.from(b, x => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%'[x % 61]).join(''); };
/**
 * Cria login e senha para uma profissional: a conta é criada numa instância separada do Firebase
 * (a sessão da administração continua ativa), com senha aleatória que ninguém conhece.
 * Em seguida o Firebase envia ao e-mail o link para a pessoa definir a própria senha.
 */
export async function criarContaComSenha(email, perfil) {
  const app2 = initializeApp(configuracao, 'cadastro-' + Date.now());
  let uid;
  try {
    const auth2 = getAuth(app2);
    const cred = await createUserWithEmailAndPassword(auth2, email.trim().toLowerCase(), senhaAleatoria());
    uid = cred.user.uid;
    await signOut(auth2);
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') throw Error('Este e-mail já tem conta. Peça para a pessoa entrar e libere o acesso em "Aguardando liberação".');
    if (e.code === 'auth/operation-not-allowed') throw Error('O login por e-mail e senha não está ativado no Firebase (Authentication → Sign-in method → E-mail/senha).');
    throw e;
  } finally { await deleteApp(app2).catch(() => {}); }
  await writeBatch(db).set(doc(db, 'usuarios', uid), { ...perfil, email: email.trim().toLowerCase(), ativo: true, excluido: false, gerenciar: false, criado_em: serverTimestamp() }).commit();
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
  return uid;
}
export async function aceitarTermo(uid, versao) {
  await writeBatch(db).update(doc(db, 'usuarios', uid), { termo_lgpd: versao, termo_lgpd_em: serverTimestamp() }).commit();
}
export const sair = () => signOut(auth);
export const observarSessao = cb => onAuthStateChanged(auth, cb);
export const uidAtual = () => auth.currentUser?.uid;

// ---------- perfil ----------
export async function carregarOuCriarPerfil(u) {
  const ref = doc(db, 'usuarios', u.uid);
  const atual = await getDoc(ref);
  if (atual.exists()) return { id: u.uid, ...atual.data() };
  let convite = null;
  if (u.email && u.emailVerified) {
    try {
      const c = await getDoc(doc(db, 'convites', u.email.toLowerCase()));
      if (c.exists() && c.data().ativo === true) convite = c.data();
    } catch { /* sem convite */ }
  }
  const base = { nome: u.displayName || convite?.nome || u.email, email: u.email, criado_em: serverTimestamp() };
  const novo = convite
    ? { ...base, perfil: convite.perfil, ativo: true, especialidade: convite.especialidade || '', escolas: convite.escolas || [] }
    : { ...base, perfil: 'pendente', ativo: false };
  await writeBatch(db).set(ref, novo).commit();
  return { id: u.uid, ...novo };
}

// ---------- usuários e convites ----------
export const listarUsuarios = async () => lista(await getDocs(collection(db, 'usuarios')));
// Campos aceitos pelas regras. Contas criadas na versão antiga podem ter outros campos:
// a gravação reescreve o documento só com estes, preservando e-mail e data de criação.
const CAMPOS_USUARIO = ['nome', 'email', 'perfil', 'ativo', 'excluido', 'gerenciar', 'escolas', 'especialidade', 'registro_profissional',
  'telefone', 'jornada', 'slots', 'criado_em', 'motivo_exclusao', 'excluido_em', 'endereco', 'termo_lgpd', 'termo_lgpd_em'];
export async function salvarUsuario(uid, dados, atual = {}) {
  const base = {};
  for (const k of CAMPOS_USUARIO) if (atual[k] !== undefined) base[k] = atual[k];
  await writeBatch(db).set(doc(db, 'usuarios', uid), { ...base, ...dados, atualizado_em: serverTimestamp(), atualizado_por: uidAtual() }).commit();
}
/** Exclui o acesso (reversível). Opcionalmente cancela os agendamentos futuros da profissional. */
export async function excluirAcesso(usuario, motivo, cancelarFuturos = false) {
  let cancelados = 0;
  if (cancelarFuturos) {
    const futuros = await listarAgendamentos({ profissional: usuario.id, de: new Date(), ate: new Date(Date.now() + 730 * 864e5) });
    for (const a of futuros.filter(x => x.status === 'agendado')) { await cancelarAgendamento(a, 'Acesso da profissional excluído: ' + motivo); cancelados++; }
  }
  await salvarUsuario(usuario.id, { ativo: false, excluido: true, motivo_exclusao: motivo, excluido_em: serverTimestamp() }, usuario);
  return cancelados;
}
export async function restaurarAcesso(usuario) {
  await salvarUsuario(usuario.id, { ativo: true, excluido: false, motivo_exclusao: '' }, usuario);
}
export async function apagarSolicitacao(uid) { await writeBatch(db).delete(doc(db, 'usuarios', uid)).commit(); }
export const listarConvites = async () => lista(await getDocs(collection(db, 'convites')));
export async function salvarConvite(d) {
  const email = d.email.trim().toLowerCase();
  await writeBatch(db).set(doc(db, 'convites', email), {
    email, nome: d.nome, perfil: d.perfil, especialidade: d.especialidade || '', escolas: d.escolas || [],
    ativo: true, criado_por: uidAtual(), criado_em: serverTimestamp()
  }).commit();
}
export async function removerConvite(email) { await writeBatch(db).delete(doc(db, 'convites', email)).commit(); }

// ---------- escolas ----------
export const listarEscolas = async () => lista(await getDocs(collection(db, 'escolas')));
export async function salvarEscola(id, d) {
  const ref = id ? doc(db, 'escolas', id) : doc(collection(db, 'escolas'));
  await writeBatch(db).set(ref, d).commit();
}

// ---------- estudantes ----------
export async function listarEstudantes(perfil) {
  if (perfil.perfil !== 'direcao') return lista(await getDocs(collection(db, 'estudantes')));
  const out = [];
  for (const p of pedacos(perfil.escolas || [])) out.push(...lista(await getDocs(query(collection(db, 'estudantes'), where('escola_id', 'in', p)))));
  return out;
}
export async function lerDoc(col, id) { const s = await getDoc(doc(db, col, id)); return s.exists() ? { id: s.id, ...s.data() } : null; }

/** Cria ou atualiza o aluno com seus dados privados (e clínicos, se a equipe enviou). */
export async function salvarEstudante({ id, estudante, privado, clinico, novo }) {
  const ref = id ? doc(db, 'estudantes', id) : doc(collection(db, 'estudantes'));
  const b = writeBatch(db), quem = uidAtual();
  if (novo) b.set(ref, { ...estudante, situacao: 'ativo', criado_por: quem, criado_em: serverTimestamp() });
  else b.update(ref, { ...estudante, atualizado_por: quem, atualizado_em: serverTimestamp() });
  if (privado) b.set(doc(db, 'estudantes_privado', ref.id), { ...privado, atualizado_por: quem, atualizado_em: serverTimestamp() });
  if (clinico) b.set(doc(db, 'estudantes_clinico', ref.id), { ...clinico, atualizado_por: quem, atualizado_em: serverTimestamp() });
  await b.commit();
  return ref.id;
}

export async function importarEstudantes(registros, aoProgredir = () => {}) {
  let criados = 0, existentes = 0;
  for (const grupo of pedacos(registros, 100)) {
    const b = writeBatch(db); let n = 0;
    for (const r of grupo) {
      const ref = doc(db, 'estudantes', r.id);
      if ((await getDoc(ref)).exists()) { existentes++; continue; }
      b.set(ref, { ...r.estudante, situacao: 'ativo', origem: 'importacao_2026', criado_por: uidAtual(), criado_em: serverTimestamp() });
      if (r.necessidade) b.set(doc(db, 'estudantes_clinico', r.id), { necessidade_informada: r.necessidade, fonte: 'Informado pela escola (planilha 2026), sem confirmação clínica', atualizado_por: uidAtual(), atualizado_em: serverTimestamp() });
      n++;
    }
    if (n) await b.commit();
    criados += n; aoProgredir(criados + existentes);
  }
  return { criados, existentes };
}

// ---------- prontuário ----------
export async function listarAtendimentos({ estudanteId, de, ate, escolas } = {}) {
  const c = collection(db, 'atendimentos');
  if (estudanteId) return lista(await getDocs(query(c, where('estudante_id', '==', estudanteId))));
  const filtros = [];
  if (de) filtros.push(where('data', '>=', ts(de)));
  if (ate) filtros.push(where('data', '<', ts(ate)));
  if (escolas) {
    const out = [];
    for (const p of pedacos(escolas)) out.push(...lista(await getDocs(query(c, where('escola_id', 'in', p), ...filtros))));
    return out;
  }
  return lista(await getDocs(filtros.length ? query(c, ...filtros) : c));
}
export async function listarRegistros(estudanteId) {
  return lista(await getDocs(query(collection(db, 'atendimentos_registro'), where('estudante_id', '==', estudanteId))));
}
export async function listarVersoes(atendimentoId) {
  return lista(await getDocs(query(collection(db, 'atendimentos_versoes'), where('atendimento_id', '==', atendimentoId))));
}

/** Registra o atendimento; se veio de um agendamento, conclui-o no mesmo lote. */
export async function registrarAtendimento({ meta, registro, agendamentoId = '', codigo = '' }) {
  const ref = doc(collection(db, 'atendimentos')), b = writeBatch(db), uid = uidAtual();
  // A consulta agendada mantém o mesmo código; atendimento sem agendamento ganha um código novo.
  const cod = codigo || gerarCodigo(meta.data);
  b.set(ref, { ...meta, data: ts(meta.data), agendamento_id: agendamentoId, codigo: cod, profissional_uid: uid, situacao: 'valido', versao: 1, criado_em: serverTimestamp(), atualizado_em: serverTimestamp() });
  b.set(doc(db, 'atendimentos_registro', ref.id), { ...registro, estudante_id: meta.estudante_id, profissional_uid: uid, versao: 1 });
  if (agendamentoId) b.update(doc(db, 'agendamentos', agendamentoId), { status: 'realizado', atendimento_id: ref.id, alterado_por: uid, alterado_em: serverTimestamp() });
  await b.commit();
  return ref.id;
}

async function comVersao(id, motivo, alterar) {
  await runTransaction(db, async tx => {
    const aRef = doc(db, 'atendimentos', id), rRef = doc(db, 'atendimentos_registro', id);
    const [a, r] = [await tx.get(aRef), await tx.get(rRef)];
    if (!a.exists()) throw Error('Atendimento não encontrado.');
    const atual = a.data();
    if (atual.situacao !== 'valido') throw Error('Este atendimento já foi anulado.');
    tx.set(doc(db, 'atendimentos_versoes', id + '_' + atual.versao), {
      atendimento_id: id, versao: atual.versao, autor_uid: uidAtual(), em: serverTimestamp(), motivo,
      atendimento: atual, registro: r.exists() ? r.data() : {}
    });
    alterar(tx, aRef, rRef, atual, r.exists() ? r.data() : null);
  });
}
export function retificarAtendimento(id, meta, registro, motivo) {
  return comVersao(id, motivo, (tx, aRef, rRef, atual, reg) => {
    const versao = atual.versao + 1;
    tx.update(aRef, { tipo: meta.tipo, evolucao: meta.evolucao, data: ts(meta.data), duracao_min: meta.duracao_min, versao, atualizado_em: serverTimestamp() });
    tx.update(rRef, { ...registro, versao: (reg?.versao || 1) + 1 });
  });
}
export function anularAtendimento(id, motivo) {
  return comVersao(id, motivo, (tx, aRef, rRef, atual) => {
    tx.update(aRef, { situacao: 'anulado', motivo_anulacao: motivo, anulado_por: uidAtual(), versao: atual.versao + 1, atualizado_em: serverTimestamp() });
  });
}

// ---------- agenda ----------
export async function listarAgendamentos({ de, ate, profissional, estudanteId, escolas } = {}) {
  const c = collection(db, 'agendamentos');
  if (estudanteId) return lista(await getDocs(query(c, where('estudante_id', '==', estudanteId))));
  const periodo = [where('inicio', '>=', ts(de)), where('inicio', '<', ts(ate))];
  if (profissional) return lista(await getDocs(query(c, where('profissional_uid', '==', profissional), ...periodo)));
  if (escolas) {
    const out = [];
    for (const p of pedacos(escolas)) out.push(...lista(await getDocs(query(c, where('escola_id', 'in', p), ...periodo))));
    return out;
  }
  return lista(await getDocs(query(c, ...periodo)));
}

const idReserva = (uid, t) => uid + '_' + t;
export async function agendar(p) {
  const ref = doc(collection(db, 'agendamentos'));
  const inicio = ms(p.inicio), partes = p.duracao_min === 60 ? [inicio, inicio + MEIA_HORA] : [inicio];
  const travas = partes.map(t => doc(db, 'reservas', idReserva(p.profissional_uid, t)));
  await runTransaction(db, async tx => {
    for (const t of travas) if ((await tx.get(t)).exists()) throw Error('Esse horário acabou de ser ocupado. Escolha outro.');
    tx.set(ref, { ...p, inicio: ts(inicio), codigo: gerarCodigo(inicio), status: 'agendado', criado_por: uidAtual(), criado_em: serverTimestamp() });
    travas.forEach((t, i) => tx.set(t, { agendamento_id: ref.id, profissional_uid: p.profissional_uid, inicio: ts(partes[i]) }));
  });
  return ref.id;
}
export async function cancelarAgendamento(ag, motivo) {
  const inicio = ms(ag.inicio), partes = ag.duracao_min === 60 ? [inicio, inicio + MEIA_HORA] : [inicio];
  const b = writeBatch(db);
  b.update(doc(db, 'agendamentos', ag.id), { status: 'cancelado', motivo, alterado_por: uidAtual(), alterado_em: serverTimestamp() });
  partes.forEach(t => b.delete(doc(db, 'reservas', idReserva(ag.profissional_uid, t))));
  await b.commit();
}
export async function marcarFalta(ag, motivo) {
  await writeBatch(db).update(doc(db, 'agendamentos', ag.id), { status: 'falta', motivo: motivo || '', alterado_por: uidAtual(), alterado_em: serverTimestamp() }).commit();
}

// ---------- relatórios descritivos ----------
export async function listarRelatorios(estudanteId) {
  return lista(await getDocs(query(collection(db, 'relatorios'), where('estudante_id', '==', estudanteId))));
}
export async function emitirRelatorio(d) {
  const ref = doc(collection(db, 'relatorios'));
  await writeBatch(db).set(ref, { ...d, profissional_uid: uidAtual(), criado_em: serverTimestamp() }).commit();
  return ref.id;
}
