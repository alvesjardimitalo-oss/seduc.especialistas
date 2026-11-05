// Cópia de segurança criptografada (AES-256-GCM com chave derivada da senha por PBKDF2-SHA256).
// Funciona no navegador e no Node 20+ (Web Crypto), para o mesmo arquivo ser aberto nos dois.
export const FORMATO = 'seduc-backup-v1';
export const COLECOES = ['usuarios', 'convites', 'escolas', 'estudantes', 'estudantes_privado', 'estudantes_clinico', 'atendimentos', 'atendimentos_registro',
  'atendimentos_versoes', 'agendamentos', 'reservas', 'condicoes', 'bloqueios', 'relatorios', 'pedidos', 'frequencias', 'planos', 'acessos'];
const ITERACOES = 310000;
const te = new TextEncoder(), td = new TextDecoder();
const b64 = buf => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const deB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function chave(senha, sal, iteracoes) {
  const base = await crypto.subtle.importKey('raw', te.encode(senha), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteracoes }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Converte valores do Firestore (Timestamp) em texto ISO para o JSON. */
export function serializavel(v) {
  if (v && typeof v.toDate === 'function') return { __ts: v.toDate().toISOString() };
  if (Array.isArray(v)) return v.map(serializavel);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, serializavel(x)]));
  return v;
}

export function validarSenha(senha) {
  if (String(senha || '').length < 12) throw Error('Use uma senha com pelo menos 12 caracteres (guarde-a em local seguro: sem ela a cópia não abre).');
}

/** Criptografa o objeto `dados` e devolve o envelope (JSON) do arquivo. */
export async function criptografar(dados, senha, info = {}) {
  validarSenha(senha);
  const sal = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await chave(senha, sal, ITERACOES);
  const cifra = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, te.encode(JSON.stringify(dados)));
  return { formato: FORMATO, gerado_em: new Date().toISOString(), ...info, kdf: 'PBKDF2-SHA256', iteracoes: ITERACOES, sal: b64(sal), iv: b64(iv), dados: b64(cifra) };
}

/** Abre o envelope com a senha. Senha errada ou arquivo alterado: erro. */
export async function abrir(envelope, senha) {
  if (envelope?.formato !== FORMATO) throw Error('Arquivo não é uma cópia de segurança do SEDUC Especialistas.');
  const k = await chave(senha, deB64(envelope.sal), envelope.iteracoes);
  try { return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(envelope.iv) }, k, deB64(envelope.dados)))); }
  catch { throw Error('Senha incorreta ou arquivo corrompido.'); }
}
