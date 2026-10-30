// Simulador mínimo do SDK Firebase, em memória, para testar a interface no navegador
// sem rede. NÃO aplica regras de segurança (essas são testadas no emulador oficial).
const banco = window.__banco ||= new Map(); // caminho -> dados
let usuarioAtual = null; const ouvintes = [];

export class Timestamp {
  constructor(ms) { this._ms = ms; }
  static fromDate(d) { return new Timestamp(d.getTime()); }
  static fromMillis(ms) { return new Timestamp(ms); }
  static now() { return new Timestamp(Date.now()); }
  toMillis() { return this._ms; } toDate() { return new Date(this._ms); }
}
const SERVIDOR = { __servidor: true };
export const serverTimestamp = () => SERVIDOR;
const resolver = d => { const o = {}; for (const [k, v] of Object.entries(d)) o[k] = v === SERVIDOR ? Timestamp.now() : v; return o; };

export const initializeApp = (c, nome) => ({ c, nome });
export const deleteApp = async () => {};
window.__emails = window.__emails || [];
export async function signInWithEmailAndPassword(_, email, senha) {
  const u = window.__usuarioTeste; if (!u || !senha) throw Object.assign(Error('cred'), { code: 'auth/invalid-credential' });
  usuarioAtual = u; ouvintes.forEach(f => f(usuarioAtual)); return { user: u };
}
export async function sendPasswordResetEmail(_, email) { window.__emails.push(email); }
export async function createUserWithEmailAndPassword(_, email) { return { user: { uid: 'novo_' + email.split('@')[0].replace(/\W/g, '') } }; }
export const getAuth = app => ({ secundaria: Boolean(app?.nome), get currentUser() { return usuarioAtual; } });
export class GoogleAuthProvider {}
export async function signInWithPopup() {
  usuarioAtual = window.__usuarioTeste; ouvintes.forEach(f => f(usuarioAtual)); return { user: usuarioAtual };
}
export function onAuthStateChanged(_, cb) { ouvintes.push(cb); setTimeout(() => cb(usuarioAtual), 0); return () => {}; }
export async function signOut(a) { if (a && a.secundaria) return; usuarioAtual = null; ouvintes.forEach(f => f(null)); }
export const getFirestore = () => ({});

let seq = 0;
export const collection = (_, ...p) => ({ tipo: 'col', caminho: p.join('/') });
export function doc(a, ...p) {
  if (a?.tipo === 'col') return { tipo: 'doc', caminho: a.caminho + '/' + (p[0] || 'auto' + (++seq) + Date.now().toString(36)), get id() { return this.caminho.split('/').pop(); } };
  const caminho = p.join('/'); return { tipo: 'doc', caminho, get id() { return caminho.split('/').pop(); } };
}
const snap = (ref, d) => ({ id: ref.caminho.split('/').pop(), exists: () => d !== undefined, data: () => d && structuredCloneTs(d) });
const structuredCloneTs = d => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v]));
export async function getDoc(ref) { await atraso(); return snap(ref, banco.get(ref.caminho)); }
export const where = (campo, op, valor) => ({ campo, op, valor });
export const query = (col, ...filtros) => ({ ...col, filtros });
const val = v => v?.toMillis ? v.toMillis() : v;
export async function getDocs(q) {
  await atraso();
  const prefixo = q.caminho + '/', docs = [];
  for (const [k, d] of banco) {
    if (!k.startsWith(prefixo) || k.slice(prefixo.length).includes('/')) continue;
    const ok = (q.filtros || []).every(f => {
      const a = val(d[f.campo]), b = val(f.valor);
      return f.op === '==' ? a === b : f.op === 'in' ? b.includes(a) : f.op === '>=' ? a >= b : f.op === '<' ? a < b : f.op === '<=' ? a <= b : f.op === '>' ? a > b : true;
    });
    if (ok) docs.push(snap({ caminho: k }, d));
  }
  return { docs };
}
function aplicar(ops) {
  for (const o of ops) {
    if (o.op === 'set') banco.set(o.ref.caminho, resolver(o.d));
    if (o.op === 'update') { if (!banco.has(o.ref.caminho)) throw Object.assign(Error('not-found'), { code: 'not-found' }); banco.set(o.ref.caminho, { ...banco.get(o.ref.caminho), ...resolver(o.d) }); }
    if (o.op === 'delete') banco.delete(o.ref.caminho);
  }
}
export function writeBatch() {
  const ops = [];
  const b = { set: (ref, d) => (ops.push({ op: 'set', ref, d }), b), update: (ref, d) => (ops.push({ op: 'update', ref, d }), b), delete: ref => (ops.push({ op: 'delete', ref }), b), commit: async () => { await atraso(); window.__gravacoes = (window.__gravacoes || 0) + 1; aplicar(ops); } };
  return b;
}
export async function runTransaction(_, fn) {
  const ops = [];
  const tx = { get: getDoc, set: (r, d) => (ops.push({ op: 'set', ref: r, d }), tx), update: (r, d) => (ops.push({ op: 'update', ref: r, d }), tx), delete: r => (ops.push({ op: 'delete', ref: r }), tx) };
  const r = await fn(tx); aplicar(ops); return r;
}
const atraso = () => new Promise(r => setTimeout(r, 5));
