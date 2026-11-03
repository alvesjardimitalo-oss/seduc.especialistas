// Regras de negócio puras (sem Firebase). Testadas em tests/dominio.test.mjs.
// Fuso municipal: America/Sao_Paulo (UTC-3, sem horário de verão vigente).

export const FUSO_MS = 3 * 60 * 60 * 1000;
export const MEIA_HORA = 30 * 60 * 1000;

export const ESPECIALIDADES = Object.freeze({
  fonoaudiologia: 'Fonoaudiologia',
  neuropsicologia: 'Neuropsicologia',
  psicopedagogia: 'Psicopedagogia'
});

export const PERFIS = Object.freeze({
  especialista: 'Especialista',
  secretaria: 'Secretaria de Educação',
  direcao: 'Direção escolar',
  superadmin: 'Administração',
  pendente: 'Aguardando liberação'
});

export const TIPOS_ATENDIMENTO = Object.freeze({
  avaliacao: 'Avaliação inicial',
  sessao: 'Sessão individual',
  grupo: 'Atendimento em grupo',
  observacao_sala: 'Observação em sala de aula',
  reavaliacao: 'Reavaliação',
  reuniao: 'Reunião com professora / família',
  devolutiva: 'Devolutiva à família',
  orientacao: 'Orientação à escola',
  alta: 'Alta / encerramento'
});

export const EVOLUCAO = Object.freeze({
  avancou: 'Avançou',
  estavel: 'Estável',
  regrediu: 'Regrediu',
  nao_avaliado: 'Não avaliado'
});

export const STATUS_AGENDA = Object.freeze({
  agendado: 'Agendado',
  realizado: 'Realizado',
  falta: 'Falta do aluno',
  cancelado: 'Cancelado'
});

export const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Registro da consulta: até 500 caracteres no total (trabalhado + desenvolvido + orientações).
export const LIMITES = Object.freeze({ texto: 500, motivo: 500, relatorio: 10000, nome: 180 });

/** Código único da consulta, legível: C + AAMMDD + '-' + 4 caracteres (ex.: C261030-7K3F). */
export function gerarCodigo(data = Date.now(), aleatorio = Math.random) {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let sufixo = ''; for (let i = 0; i < 4; i++) sufixo += alfabeto[Math.floor(aleatorio() * alfabeto.length)];
  return 'C' + diaMunicipal(data).slice(2).replace(/-/g, '') + '-' + sufixo;
}
export const codigoValido = c => /^C[0-9]{6}-[A-Z0-9]{4}$/.test(String(c || ''));

export function cpfValido(cpf) {
  const n = String(cpf || '').replace(/\D/g, '');
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  for (const t of [9, 10]) {
    let soma = 0; for (let i = 0; i < t; i++) soma += Number(n[i]) * (t + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(n[t])) return false;
  }
  return true;
}
export const formatarCPF = cpf => { const n = String(cpf || '').replace(/\D/g, ''); return n.length === 11 ? n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : n; };

// ---------- datas no horário municipal ----------
export const ms = v => {
  if (v == null || v === '') return NaN;
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  return new Date(v).getTime();
};
const municipal = t => new Date(ms(t) - FUSO_MS);
const pad = n => String(n).padStart(2, '0');

/** 'AAAA-MM-DD' no horário municipal */
export function diaMunicipal(t) {
  const d = municipal(t);
  return Number.isNaN(d.getTime()) ? '' : d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}
export function horaMunicipal(t) {
  const d = municipal(t);
  return Number.isNaN(d.getTime()) ? '' : pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes());
}
/** Converte 'AAAA-MM-DD' + 'HH:MM' (horário municipal) em Date. */
export function instante(dia, hora = '00:00') {
  const [a, m, d] = String(dia).split('-').map(Number);
  const [h, mi] = String(hora).split(':').map(Number);
  if (![a, m, d, h, mi].every(Number.isInteger)) return null;
  return new Date(Date.UTC(a, m - 1, d, h, mi) + FUSO_MS);
}
export function diaDaSemana(dia) { const t = instante(dia, '12:00'); return t ? municipal(t).getUTCDay() : -1; }
export function somarDias(dia, n) { const t = instante(dia, '12:00'); return t ? diaMunicipal(t.getTime() + n * 86400000) : ''; }
export function inicioDaSemana(dia) { return somarDias(dia, -diaDaSemana(dia)); }
export function formatarData(t) { const d = diaMunicipal(t); return d ? d.split('-').reverse().join('/') : '—'; }
export function formatarDataHora(t) { const d = formatarData(t); return d === '—' ? d : d + ' ' + horaMunicipal(t); }
export function idade(nascimento, hoje = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento || '')) return null;
  const [a, m, d] = nascimento.split('-').map(Number);
  const [ha, hm, hd] = diaMunicipal(hoje).split('-').map(Number);
  let anos = ha - a; if (hm < m || (hm === m && hd < d)) anos--;
  return anos >= 0 && anos < 30 ? anos : null;
}

// ---------- jornada ----------
/** Índice de meia hora na semana: dia*48 + meias-horas (horário municipal). */
export function indiceSlot(t) {
  const d = municipal(t);
  return d.getUTCDay() * 48 + d.getUTCHours() * 2 + Math.floor(d.getUTCMinutes() / 30);
}
const minutos = h => { const m = /^([01]\d|2[0-3]):([03]0)$/.exec(h || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

/** Valida as faixas de jornada e devolve {jornada normalizada, slots}. */
export function prepararJornada(faixas = []) {
  const jornada = [], slots = new Set();
  for (const f of faixas) {
    const dia = Number(f.dia), ini = minutos(f.inicio), fim = minutos(f.fim);
    if (!Number.isInteger(dia) || dia < 0 || dia > 6) throw Error('Dia da jornada inválido.');
    if (ini == null || fim == null) throw Error('Use horários cheios ou de meia hora (ex.: 08:00, 13:30).');
    if (fim <= ini) throw Error(DIAS[dia] + ': o fim deve ser depois do início.');
    for (let m = ini; m < fim; m += 30) {
      const idx = dia * 48 + m / 30;
      if (slots.has(idx)) throw Error(DIAS[dia] + ': há faixas sobrepostas.');
      slots.add(idx);
    }
    jornada.push({ dia, inicio: f.inicio, fim: f.fim, escola_id: String(f.escola_id || '') });
  }
  jornada.sort((a, b) => a.dia - b.dia || a.inicio.localeCompare(b.inicio));
  return { jornada, slots: [...slots].sort((a, b) => a - b) };
}

export function resumoJornada(jornada = [], nomeEscola = () => '') {
  if (!jornada.length) return 'Jornada não definida';
  return jornada.map(f => DIAS[f.dia].slice(0, 3) + ' ' + f.inicio + '–' + f.fim + (f.escola_id ? ' (' + nomeEscola(f.escola_id) + ')' : '')).join(' · ');
}

/** Faixa da jornada que contém o horário, para mostrar o local de trabalho do dia. */
export function faixaDoHorario(jornada = [], t) {
  const idx = indiceSlot(t), dia = Math.floor(idx / 48), m = (idx % 48) * 30;
  return jornada.find(f => f.dia === dia && minutos(f.inicio) <= m && m < minutos(f.fim)) || null;
}

/**
 * Horários livres de uma profissional em um dia.
 * @param slots índices da jornada
 * @param ocupados lista de {inicio, duracao_min, status}
 */
export function horariosLivres({ dia, slots = [], ocupados = [], duracao = 30, agora = Date.now() }) {
  const set = new Set(slots), livres = [];
  const reservados = new Set();
  for (const a of ocupados) {
    if (a.status === 'cancelado') continue;
    const n = a.duracao_min === 60 ? 2 : 1;
    for (let i = 0; i < n; i++) reservados.add(ms(a.inicio) + i * MEIA_HORA);
  }
  const base = instante(dia, '00:00'); if (!base) return [];
  for (let k = 0; k < 48; k++) {
    const t = base.getTime() + k * MEIA_HORA, partes = duracao === 60 ? [t, t + MEIA_HORA] : [t];
    if (t <= agora) continue;
    if (partes.every(p => set.has(indiceSlot(p)) && !reservados.has(p))) livres.push(new Date(t));
  }
  return livres;
}

export function validarAgendamento({ inicio, duracao, slots = [], ocupados = [], agora = Date.now(), bloqueios = [], escola = '' }) {
  const t = ms(inicio);
  const b = bloqueioDoDia(diaMunicipal(t), escola, bloqueios);
  if (b) throw Error('Dia bloqueado no calendário escolar: ' + b.motivo + '.');
  if (!Number.isFinite(t)) throw Error('Horário inválido.');
  if (t % MEIA_HORA !== 0) throw Error('Escolha hora cheia ou meia hora.');
  if (t <= agora) throw Error('O agendamento precisa ser no futuro.');
  if (![30, 60].includes(duracao)) throw Error('Duração deve ser 30 ou 60 minutos.');
  const livres = horariosLivres({ dia: diaMunicipal(t), slots, ocupados, duracao, agora });
  if (!livres.some(d => d.getTime() === t)) throw Error('Horário fora da jornada da profissional ou já ocupado.');
  return true;
}

// ---------- estudantes ----------
export const normalizar = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function validarEstudante(d) {
  const nome = String(d.nome || '').trim().replace(/\s+/g, ' ');
  if (nome.length < 3 || nome.length > LIMITES.nome) throw Error('Informe o nome completo do aluno.');
  if (!d.escola_id) throw Error('Selecione a escola.');
  if (d.nascimento && !/^\d{4}-\d{2}-\d{2}$/.test(d.nascimento)) throw Error('Data de nascimento inválida.');
  if (d.nascimento && idade(d.nascimento) == null) throw Error('Confira a data de nascimento.');
  if (d.cpf && !cpfValido(d.cpf)) throw Error('CPF inválido.');
  return {
    nome, escola_id: d.escola_id, nascimento: d.nascimento || '',
    turma: String(d.turma || '').trim().slice(0, 80), turno: String(d.turno || ''),
    ano_letivo: Number(d.ano_letivo) || new Date().getFullYear()
  };
}

/** Possíveis duplicidades: mesmo nome normalizado (e mesmo nascimento quando houver). */
export function possiveisDuplicados(lista, d, ignorarId = '') {
  const n = normalizar(d.nome);
  return lista.filter(e => e.id !== ignorarId && normalizar(e.nome) === n && (!d.nascimento || !e.nascimento || e.nascimento === d.nascimento));
}

export function filtrarEstudantes(lista, { busca = '', escola = '', situacao = 'ativo', especialidade = '' } = {}, acompanhamento = new Map()) {
  const b = normalizar(busca);
  return lista.filter(e => (!b || normalizar(e.nome).includes(b))
    && (!escola || e.escola_id === escola)
    && (!situacao || (e.situacao || 'ativo') === situacao)
    && (!especialidade || (acompanhamento.get(e.id)?.especialidades || []).includes(especialidade)))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

// ---------- prontuário ----------
// Registro no formato SOAP do PEC, adaptado à escola. Registros antigos (trabalhado/desenvolvido/orientações)
// continuam válidos para leitura.
export const CAMPOS_SOAP = Object.freeze([
  ['subjetivo', 'S — Subjetivo', 'Queixa e relato do aluno, da família ou da professora'],
  ['objetivo', 'O — Objetivo', 'O que foi observado e trabalhado: atividades, recursos, desempenho'],
  ['avaliacao', 'A — Avaliação', 'Análise profissional: evolução, dificuldades, hipóteses'],
  ['plano', 'P — Plano', 'Próximos passos, orientações à família e encaminhamentos']
]);
const CAMPOS_ANTIGOS = [['trabalhado', 'O que foi trabalhado'], ['desenvolvido', 'O que foi desenvolvido'], ['orientacoes', 'Orientações e próximos passos']];
/** Seções de texto de um registro (SOAP ou formato antigo), na ordem de leitura. */
export function secoesRegistro(r = {}) {
  return [...CAMPOS_SOAP.map(([k, t]) => [t, r[k]]), ...CAMPOS_ANTIGOS.map(([k, t]) => [t, r[k]])].filter(([, v]) => String(v || '').trim());
}
/** Plano (P) do registro, ou as orientações do formato antigo. */
export const planoDoRegistro = (r = {}) => String(r.plano || r.orientacoes || '').trim();
export function validarRegistro(d) {
  const r = {};
  for (const [k] of CAMPOS_SOAP) r[k] = String(d[k] || '').trim();
  const total = CAMPOS_SOAP.reduce((n, [k]) => n + r[k].length, 0);
  if (total > LIMITES.texto) throw Error('O registro da consulta aceita até ' + LIMITES.texto + ' caracteres no total (agora: ' + total + ').');
  if (!r.objetivo) throw Error('Preencha o Objetivo: o que foi observado e trabalhado no atendimento.');
  if (!TIPOS_ATENDIMENTO[d.tipo]) throw Error('Selecione o tipo de atendimento.');
  if (!EVOLUCAO[d.evolucao]) throw Error('Selecione a evolução observada.');
  r.orientacao_escola = String(d.orientacao_escola || '').trim();
  if (r.orientacao_escola.length > LIMITES.texto) throw Error('A orientação para a escola aceita até ' + LIMITES.texto + ' caracteres.');
  return r;
}

// ---------- problemas e condições (lista do PEC) ----------
export function validarCondicao(d) {
  const descricao = String(d.descricao || '').trim().replace(/\s+/g, ' ');
  if (descricao.length < 3 || descricao.length > 150) throw Error('Descreva o problema ou condição (3 a 150 caracteres).');
  const observacao = String(d.observacao || '').trim();
  if (observacao.length > 300) throw Error('A observação aceita até 300 caracteres.');
  return { descricao, observacao };
}
/** Ativos primeiro (mais recentes no topo), depois resolvidos. */
export const ordenarCondicoes = (lista = []) => lista.slice().sort((a, b) => (a.situacao === 'ativo' ? 0 : 1) - (b.situacao === 'ativo' ? 0 : 1) || ms(b.criado_em) - ms(a.criado_em));

// ---------- lista de atendimento do dia (chegada) ----------
/** Ordem da fila: quem chegou primeiro (pela hora de chegada), depois os demais pelo horário marcado. */
export function filaDoDia(itens = []) {
  return itens.slice().sort((a, b) => {
    const ca = a.status === 'agendado' && a.chegada_em ? ms(a.chegada_em) : null, cb = b.status === 'agendado' && b.chegada_em ? ms(b.chegada_em) : null;
    if (ca != null && cb != null) return ca - cb;
    if (ca != null) return -1; if (cb != null) return 1;
    return ms(a.inicio) - ms(b.inicio);
  });
}

/** Ordena a linha do tempo (mais recente primeiro). */
export function linhaDoTempo(atendimentos = [], { especialidade = '', incluirAnulados = true } = {}) {
  return atendimentos
    .filter(a => (!especialidade || a.especialidade === especialidade) && (incluirAnulados || a.situacao !== 'anulado'))
    .sort((a, b) => ms(b.data) - ms(a.data));
}

/**
 * Situação do acompanhamento por especialidade, derivada dos registros:
 * aguardando (sem atendimento válido), em_acompanhamento, alta.
 */
export function situacaoAcompanhamento(atendimentos = []) {
  const validos = atendimentos.filter(a => a.situacao !== 'anulado').sort((a, b) => ms(a.data) - ms(b.data));
  const porEsp = {};
  for (const a of validos) porEsp[a.especialidade] = { ultimo: a, total: (porEsp[a.especialidade]?.total || 0) + 1 };
  const especialidades = Object.keys(porEsp).filter(e => porEsp[e].ultimo.tipo !== 'alta');
  return {
    porEspecialidade: porEsp,
    especialidades,
    altas: Object.keys(porEsp).filter(e => porEsp[e].ultimo.tipo === 'alta'),
    ultimo: validos[validos.length - 1] || null,
    total: validos.length,
    estado: !validos.length ? 'aguardando' : especialidades.length ? 'em_acompanhamento' : 'alta'
  };
}

export function mapaAcompanhamento(atendimentos = []) {
  const grupos = new Map();
  for (const a of atendimentos) { if (!grupos.has(a.estudante_id)) grupos.set(a.estudante_id, []); grupos.get(a.estudante_id).push(a); }
  const mapa = new Map();
  for (const [id, lista] of grupos) mapa.set(id, situacaoAcompanhamento(lista));
  return mapa;
}

// ---------- relatórios gerenciais ----------
export function noPeriodo(t, de, ate) {
  const d = diaMunicipal(t);
  return Boolean(d) && (!de || d >= de) && (!ate || d <= ate);
}

export function resumoGerencial({ atendimentos = [], agendamentos = [], filtros = {} }) {
  const f = filtros;
  const ok = r => (!f.escola || r.escola_id === f.escola) && (!f.especialidade || r.especialidade === f.especialidade) && (!f.profissional || r.profissional_uid === f.profissional);
  const at = atendimentos.filter(a => a.situacao !== 'anulado' && ok(a) && noPeriodo(a.data, f.de, f.ate));
  const ag = agendamentos.filter(a => ok(a) && noPeriodo(a.inicio, f.de, f.ate));
  const contar = (lista, chave) => { const m = {}; for (const r of lista) { const k = chave(r) || '—'; m[k] = (m[k] || 0) + 1; } return m; };
  const distintos = lista => new Set(lista.map(a => a.estudante_id)).size;
  const porEscola = {};
  for (const a of at) {
    const e = porEscola[a.escola_id] ||= { atendimentos: 0, alunos: new Set(), porEspecialidade: {} };
    e.atendimentos++; e.alunos.add(a.estudante_id); e.porEspecialidade[a.especialidade] = (e.porEspecialidade[a.especialidade] || 0) + 1;
  }
  for (const e of Object.values(porEscola)) e.alunos = e.alunos.size;
  const porProfissional = {};
  for (const a of at) {
    const p = porProfissional[a.profissional_uid] ||= { nome: a.profissional_nome, especialidade: a.especialidade, atendimentos: 0, alunos: new Set(), minutos: 0 };
    p.atendimentos++; p.alunos.add(a.estudante_id); p.minutos += Number(a.duracao_min) || 0;
  }
  for (const p of Object.values(porProfissional)) p.alunos = p.alunos.size;
  const faltasPorProf = contar(ag.filter(a => a.status === 'falta'), a => a.profissional_uid);
  for (const [uid, n] of Object.entries(faltasPorProf)) if (porProfissional[uid]) porProfissional[uid].faltas = n;
  return {
    atendimentos: at.length,
    alunos: distintos(at),
    horas: Math.round(at.reduce((s, a) => s + (Number(a.duracao_min) || 0), 0) / 6) / 10,
    agendados: ag.filter(a => a.status === 'agendado').length,
    faltas: ag.filter(a => a.status === 'falta').length,
    cancelados: ag.filter(a => a.status === 'cancelado').length,
    altas: at.filter(a => a.tipo === 'alta').length,
    porEspecialidade: contar(at, a => a.especialidade),
    porTipo: contar(at, a => a.tipo),
    porEscola,
    porProfissional
  };
}

export function csv(linhas) {
  const cel = v => { const s = String(v ?? ''); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '﻿' + linhas.map(l => l.map(cel).join(';')).join('\r\n');
}

// ---------- importação do arquivo privado de alunos 2026 ----------
// Palavra-chave do nome de cada instituição: reconhece a escola mesmo cadastrada com outro identificador.
export const CHAVES_ESCOLAS = Object.freeze({
  'doutor-joao-souza-lima': 'joao de souza lima', 'professora-terezinha-sarmento': 'terezinha sarmento',
  'prefeito-jose-pedro': 'jose pedro', 'monteiro-lobato': 'monteiro lobato',
  'creche-wilma-gloria': 'wilma gloria', 'creche-sebastiana-duarte-cabral': 'sebastiana'
});
// Logotipos oficiais (pasta img/logos). Escola sem arquivo usa as iniciais.
export const LOGO_SEDUC = 'img/logos/seduc.png';
export const LOGOS_ESCOLAS = Object.freeze({
  'doutor-joao-souza-lima': 'img/logos/joao-souza-lima.png',
  'professora-terezinha-sarmento': 'img/logos/terezinha-sarmento.png',
  'monteiro-lobato': 'img/logos/monteiro-lobato.png',
  'creche-sebastiana-duarte-cabral': 'img/logos/sebastiana-duarte-cabral.png',
  'creche-wilma-gloria': 'img/logos/wilma-gloria.png'
});
// Versão reduzida para os selos pequenos da tela (quando houver).
export const ICONES_ESCOLAS = Object.freeze({});
/** Caminho do logotipo da escola (pelo ID padrão ou pelo nome cadastrado); '' se não houver. */
function idPadraoEscola(escola) {
  if (!escola) return '';
  if (CHAVES_ESCOLAS[escola.id]) return escola.id;
  const nome = normalizar(escola.nome);
  return Object.keys(CHAVES_ESCOLAS).find(k => nome.includes(CHAVES_ESCOLAS[k])) || '';
}
export function logoEscola(escola) { return LOGOS_ESCOLAS[idPadraoEscola(escola)] || ''; }
/** Imagem para selos pequenos: o símbolo, se houver; senão o logotipo completo. */
export function iconeEscola(escola) { const id = idPadraoEscola(escola); return ICONES_ESCOLAS[id] || LOGOS_ESCOLAS[id] || ''; }
/** Encontra no cadastro a escola correspondente ao identificador padrão (pelo ID ou pelo nome). */
export function localizarEscola(idPadrao, escolas = []) {
  const porId = escolas.find(e => e.id === idPadrao);
  if (porId) return porId;
  const chave = CHAVES_ESCOLAS[idPadrao];
  return chave ? escolas.find(e => normalizar(e.nome).includes(chave)) || null : null;
}
/** Ajusta o escola_id dos registros para as escolas existentes; devolve os identificadores não encontrados. */
export function resolverEscolasImportacao(registros, escolas) {
  const faltando = new Set();
  const ajustados = registros.map(r => {
    const e = localizarEscola(r.estudante.escola_id, escolas);
    if (!e) { faltando.add(r.estudante.escola_id); return r; }
    return { ...r, estudante: { ...r.estudante, escola_id: e.id } };
  });
  return { registros: ajustados, faltando: [...faltando] };
}
const ESCOLAS_IMPORTACAO = new Set(['doutor-joao-souza-lima', 'professora-terezinha-sarmento', 'creche-wilma-gloria', 'prefeito-jose-pedro', 'monteiro-lobato', 'creche-sebastiana-duarte-cabral']);
export function conferirImportacaoAlunos(dados) {
  if (!dados || !['seduc_alunos_especiais_v1', 'seduc_alunos_especiais_v2'].includes(dados.esquema) || !Array.isArray(dados.alunos)) throw Error('Arquivo incompatível. Use o JSON privado de alunos (seduc_alunos_especiais).');
  if (!dados.alunos.length || dados.alunos.length > 2000) throw Error('Quantidade de registros inválida.');
  const ids = new Set();
  const txt = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  return dados.alunos.map(x => {
    if (typeof x.id !== 'string' || !/^alu_[a-f0-9]{24}$/.test(x.id) || ids.has(x.id)) throw Error('ID duplicado ou inválido no arquivo.');
    if (!ESCOLAS_IMPORTACAO.has(x.escola_id)) throw Error('Escola não reconhecida: ' + x.escola_id);
    ids.add(x.id);
    const nasc = /^\d{4}-\d{2}-\d{2}$/.test(x.nascimento || '') && idade(x.nascimento) != null ? x.nascimento : '';
    const cpf = cpfValido(x.cpf) ? String(x.cpf).replace(/\D/g, '') : '';
    const privado = { mae: txt(x.mae, 180), pai: txt(x.pai, 180), telefone: txt(x.telefone, 40), endereco: txt(x.endereco, 300), cpf };
    return {
      id: x.id,
      estudante: { ...validarEstudante({ nome: x.nome, escola_id: x.escola_id, turma: x.turma, ano_letivo: x.ano_letivo, nascimento: nasc }), turno: x.turno === 'integral' ? 'integral' : '' },
      privado: Object.values(privado).some(Boolean) ? privado : null,
      necessidade: txt(x.deficiencia, 1000),
      observacoes: txt(x.observacoes, 3000)
    };
  });
}

// ---------- painel: lista unificada de consultas ----------
/** Junta agendamentos e atendimentos avulsos (sem agendamento) numa lista de consultas. */
export function consultasDoPainel({ agendamentos = [], atendimentos = [], estudantes = [], filtros = {} }) {
  const nomes = new Map(estudantes.map(e => [e.id, e.nome]));
  const avulsos = atendimentos.filter(a => !a.agendamento_id && a.situacao !== 'anulado')
    .map(a => ({ ...a, tipo_item: 'atendimento', inicio: a.data, status: 'realizado' }));
  const agenda = agendamentos.map(a => ({ ...a, tipo_item: 'agendamento' }));
  const b = normalizar(filtros.busca);
  return [...agenda, ...avulsos].filter(c =>
    (!b || normalizar(nomes.get(c.estudante_id)).includes(b) || normalizar(c.codigo).includes(b))
    && (!filtros.dia || diaMunicipal(c.inicio) === filtros.dia)
    && (!filtros.profissional || c.profissional_uid === filtros.profissional)
    && (!filtros.escola || c.escola_id === filtros.escola)
    && (filtros.mostrarCancelados || c.status !== 'cancelado'))
    .sort((x, y) => ms(x.inicio) - ms(y.inicio));
}

// ---------- calendário escolar (dias sem atendimento) ----------
/** Número do dia (dias desde 1970 no calendário municipal) — igual ao calculado nas regras do Firestore. */
export function numeroDoDia(dia) { const [a, m, d] = String(dia).split('-').map(Number); return Date.UTC(a, m - 1, d) / 864e5; }
export const idBloqueio = (dia, escola = '') => 'd' + numeroDoDia(dia) + (escola ? '_' + escola : '');
/** Bloqueio que atinge o dia (da rede toda ou da escola), ou null. */
export function bloqueioDoDia(dia, escola, bloqueios = []) {
  return bloqueios.find(b => b.id === idBloqueio(dia)) || (escola ? bloqueios.find(b => b.id === idBloqueio(dia, escola)) : null) || null;
}
/** Valida um período de bloqueio e devolve os dias (no máximo 92). */
export function diasDoBloqueio({ de, ate, motivo }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(de || '') || !/^\d{4}-\d{2}-\d{2}$/.test(ate || de || '')) throw Error('Informe as datas.');
  const fim = ate || de;
  if (fim < de) throw Error('A data final deve ser igual ou posterior à inicial.');
  if (!String(motivo || '').trim()) throw Error('Informe o motivo (ex.: recesso escolar, feriado).');
  const dias = []; for (let d = de; d <= fim; d = somarDias(d, 1)) { dias.push(d); if (dias.length > 92) throw Error('Período máximo de 92 dias por vez.'); }
  return dias;
}

// ---------- feriados nacionais (para o calendário escolar) ----------
/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), 'AAAA-MM-DD'. */
export function pascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return ano + '-' + pad(mes) + '-' + pad(dia);
}
/** Feriados nacionais e pontos facultativos usuais na rede, em dias úteis (seg–sex). */
export function feriadosDoAno(ano) {
  const p = pascoa(ano);
  const lista = [
    [ano + '-01-01', 'Confraternização Universal'], [somarDias(p, -48), 'Carnaval'], [somarDias(p, -47), 'Carnaval'],
    [somarDias(p, -46), 'Quarta-feira de Cinzas (ponto facultativo)'], [somarDias(p, -2), 'Sexta-feira Santa'],
    [ano + '-04-21', 'Tiradentes'], [ano + '-05-01', 'Dia do Trabalho'], [somarDias(p, 60), 'Corpus Christi'],
    [ano + '-09-07', 'Independência do Brasil'], [ano + '-10-12', 'Nossa Senhora Aparecida'], [ano + '-10-15', 'Dia do Professor'],
    [ano + '-11-02', 'Finados'], [ano + '-11-15', 'Proclamação da República'], [ano + '-11-20', 'Dia da Consciência Negra'],
    [ano + '-12-25', 'Natal']
  ];
  return lista.filter(([d]) => { const w = diaDaSemana(d); return w >= 1 && w <= 5; }).map(([dia, motivo]) => ({ dia, motivo }));
}

// ---------- fila de espera (pedidos de atendimento da escola) ----------
export const PRIORIDADES = Object.freeze({ normal: 'Normal', alta: 'Alta' });
export const SITUACAO_PEDIDO = Object.freeze({ aguardando: 'Aguardando', agendado: 'Agendado', cancelado: 'Cancelado' });
export function validarPedido(d) {
  const motivo = String(d.motivo || '').trim();
  if (!d.estudante_id) throw Error('Selecione o aluno.');
  if (!ESPECIALIDADES[d.especialidade]) throw Error('Escolha a especialidade.');
  if (motivo.length < 10) throw Error('Descreva o que a escola observou (pelo menos 10 caracteres).');
  if (motivo.length > 1000) throw Error('O motivo aceita até 1.000 caracteres.');
  return { estudante_id: d.estudante_id, especialidade: d.especialidade, motivo, prioridade: d.prioridade === 'alta' ? 'alta' : 'normal' };
}
const DIA_MS = 864e5;
export const diasDeEspera = (p, agora = Date.now()) => Math.max(0, Math.floor((ms(p.situacao === 'aguardando' ? agora : p.atualizado_em) - ms(p.criado_em)) / DIA_MS));
/** Fila ordenada: prioridade alta primeiro, depois quem espera há mais tempo. */
export function ordenarFila(pedidos = []) {
  return pedidos.filter(p => p.situacao === 'aguardando').sort((a, b) => (a.prioridade === 'alta' ? 0 : 1) - (b.prioridade === 'alta' ? 0 : 1) || ms(a.criado_em) - ms(b.criado_em));
}
/** Indicadores da demanda: aguardando, espera máxima e média, e tempo médio até o agendamento. */
export function resumoFila(pedidos = [], agora = Date.now(), filtro = () => true) {
  const base = pedidos.filter(filtro), espera = base.filter(p => p.situacao === 'aguardando'), atendidos = base.filter(p => p.situacao === 'agendado');
  const media = l => l.length ? Math.round(l.reduce((s, p) => s + diasDeEspera(p, agora), 0) / l.length) : 0;
  const porEspecialidade = {}, porEscola = {};
  for (const p of espera) {
    const e = porEspecialidade[p.especialidade] ||= { aguardando: 0, maisAntigo: 0 };
    e.aguardando++; e.maisAntigo = Math.max(e.maisAntigo, diasDeEspera(p, agora));
    const s = porEscola[p.escola_id] ||= { aguardando: 0, porEspecialidade: {} };
    s.aguardando++; s.porEspecialidade[p.especialidade] = (s.porEspecialidade[p.especialidade] || 0) + 1;
  }
  return { aguardando: espera.length, altas: espera.filter(p => p.prioridade === 'alta').length, esperaMedia: media(espera), esperaMaxima: espera.reduce((m, p) => Math.max(m, diasDeEspera(p, agora)), 0), tempoAteAgendar: media(atendidos), agendados: atendidos.length, porEspecialidade, porEscola };
}

// ---------- frequência das especialistas ----------
export const SITUACAO_FREQ = Object.freeze({ presente: 'Presente', falta: 'Falta', atestado: 'Atestado / licença', abonada: 'Ausência abonada' });
export const idFrequencia = (uid, dia) => uid + '_' + dia;
const minutosDaFaixa = f => (minutos(f.fim) ?? 0) - (minutos(f.inicio) ?? 0);
/** Minutos previstos pela jornada em cada dia do período, descontando os dias sem atendimento. */
export function jornadaPrevista({ jornada = [], de, ate, bloqueios = [] }) {
  const dias = [];
  if (!de || !ate || de > ate) return dias;
  for (let d = de; d <= ate; d = somarDias(d, 1)) {
    const w = diaDaSemana(d), faixas = jornada.filter(f => f.dia === w && !bloqueioDoDia(d, f.escola_id, bloqueios));
    const min = faixas.reduce((s, f) => s + minutosDaFaixa(f), 0);
    if (min > 0) dias.push({ dia: d, minutos: min, escolas: [...new Set(faixas.map(f => f.escola_id).filter(Boolean))] });
  }
  return dias;
}
/** Minutos trabalhados num registro de ponto (entrada → saída). */
export const minutosTrabalhados = r => r?.situacao === 'presente' && r.entrada && r.saida ? Math.max(0, Math.round((ms(r.saida) - ms(r.entrada)) / 60000)) : 0;
/** Consolida o mês (ou período) de uma profissional: previsto x cumprido, faltas e dias sem registro. */
export function resumoFrequencia({ registros = [], jornada = [], de, ate, bloqueios = [], hoje = diaMunicipal(Date.now()) }) {
  const previstos = jornadaPrevista({ jornada, de, ate, bloqueios }), porDia = new Map(registros.map(r => [r.dia, r]));
  const r = { diasPrevistos: previstos.length, minutosPrevistos: 0, minutosCumpridos: 0, presencas: 0, faltas: 0, justificadas: 0, semRegistro: [], semSaida: [] };
  for (const p of previstos) r.minutosPrevistos += p.minutos;
  for (const x of registros) {
    if (x.dia < de || x.dia > ate) continue;
    if (x.situacao === 'presente') { r.presencas++; r.minutosCumpridos += minutosTrabalhados(x); if (!x.saida && x.dia < hoje) r.semSaida.push(x.dia); }
    else if (x.situacao === 'falta') r.faltas++;
    else r.justificadas++;
  }
  r.semRegistro = previstos.filter(p => p.dia < hoje && !porDia.has(p.dia)).map(p => p.dia);
  return r;
}
export const formatarHoras = min => { const h = Math.floor(min / 60), m = Math.round(min % 60); return h + 'h' + (m ? pad(m) : ''); };

// ---------- plano de acompanhamento (metas) ----------
export const ESCALA_META = Object.freeze({ 1: 'Não iniciou', 2: 'Iniciando', 3: 'Em desenvolvimento', 4: 'Quase lá', 5: 'Atingiu' });
export const SITUACAO_META = Object.freeze({ ativa: 'Em andamento', atingida: 'Atingida', suspensa: 'Suspensa' });
export const idPlano = (estudanteId, especialidade) => estudanteId + '_' + especialidade;
export const MAX_METAS = 8;
/** Valida a lista de metas do formulário; mantém o identificador das metas existentes. */
export function validarMetas(lista = []) {
  const metas = [], usados = new Set();
  for (const m of lista) {
    const texto = String(m.texto || '').trim().replace(/\s+/g, ' ');
    if (!texto) continue;
    if (texto.length > 200) throw Error('Cada meta aceita até 200 caracteres.');
    let id = /^m\d{1,3}$/.test(m.id || '') && !usados.has(m.id) ? m.id : '';
    if (!id) { let n = 1; while (usados.has('m' + n) || lista.some(x => x.id === 'm' + n && x !== m)) n++; id = 'm' + n; }
    usados.add(id);
    metas.push({ id, texto, situacao: SITUACAO_META[m.situacao] ? m.situacao : 'ativa' });
  }
  if (!metas.length) throw Error('Escreva pelo menos uma meta.');
  if (metas.length > MAX_METAS) throw Error('Use no máximo ' + MAX_METAS + ' metas por especialidade.');
  return metas;
}
/** Notas válidas (1 a 5) das metas marcadas no atendimento. */
export function validarNotasMetas(d, metas = []) {
  const notas = {};
  for (const m of metas) { const v = Number(d['meta_' + m.id]); if (Number.isInteger(v) && v >= 1 && v <= 5) notas[m.id] = v; }
  return notas;
}
/** Série histórica de cada meta: [{data, nota}] na ordem dos atendimentos. */
export function seriesDasMetas(metas = [], atendimentos = [], registros = new Map()) {
  const validos = atendimentos.filter(a => a.situacao !== 'anulado').sort((a, b) => ms(a.data) - ms(b.data));
  const series = {};
  for (const m of metas) series[m.id] = [];
  for (const a of validos) {
    const notas = registros.get(a.id)?.metas || {};
    for (const m of metas) if (notas[m.id]) series[m.id].push({ data: ms(a.data), nota: notas[m.id] });
  }
  return series;
}

// ---------- lembrete pelo WhatsApp (sem dado clínico) ----------
/** Número para o link wa.me (com 55 do Brasil), ou '' se o telefone não for celular/fixo válido. */
export function numeroWhatsApp(tel) {
  let n = String(tel || '').replace(/\D/g, '').replace(/^0+/, '');
  if (n.startsWith('55') && (n.length === 12 || n.length === 13)) n = n.slice(2);
  return n.length === 10 || n.length === 11 ? '55' + n : '';
}
/** Texto do lembrete: só primeiro nome, data, hora e local — nada de especialidade ou condição. */
export function textoLembrete({ nome, inicio, escola }) {
  const primeiro = String(nome || '').trim().split(/\s+/)[0] || 'o(a) aluno(a)';
  const dia = diaMunicipal(inicio);
  return 'Olá! Lembrete da Secretaria Municipal de Educação de Frei Inocêncio: ' + primeiro + ' tem atendimento com a equipe de especialistas na '
    + DIAS[diaDaSemana(dia)].toLowerCase() + ', ' + formatarData(inicio).slice(0, 5) + ', às ' + horaMunicipal(inicio) + (escola ? ', na ' + escola : '') + '. Se não puder comparecer, avise a escola. Obrigado!';
}
export const linkWhatsApp = (tel, texto) => { const n = numeroWhatsApp(tel); return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(texto) : ''; };

// ---------- painel da Secretaria ----------
/** Últimos `n` meses (AAAA-MM) até o mês de `hoje`, do mais antigo ao mais recente. */
export function ultimosMeses(n = 12, hoje = diaMunicipal(Date.now())) {
  let [a, m] = hoje.split('-').map(Number); const meses = [];
  for (let i = 0; i < n; i++) { meses.unshift(a + '-' + pad(m)); if (--m === 0) { m = 12; a--; } }
  return meses;
}
/** Atendimentos realizados por mês e especialidade (e por escola). */
export function serieMensal(atendimentos = [], meses = ultimosMeses()) {
  const mapa = new Map(meses.map(m => [m, { mes: m, total: 0, porEspecialidade: {}, porEscola: {} }]));
  for (const a of atendimentos) {
    if (a.situacao === 'anulado') continue;
    const x = mapa.get(diaMunicipal(a.data).slice(0, 7)); if (!x) continue;
    x.total++; x.porEspecialidade[a.especialidade] = (x.porEspecialidade[a.especialidade] || 0) + 1; x.porEscola[a.escola_id] = (x.porEscola[a.escola_id] || 0) + 1;
  }
  return [...mapa.values()];
}
export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const rotuloMes = m => MESES_CURTOS[Number(m.slice(5, 7)) - 1] + '/' + m.slice(2, 4);
