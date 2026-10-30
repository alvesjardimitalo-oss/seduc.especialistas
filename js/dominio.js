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
  sessao: 'Sessão / intervenção',
  reavaliacao: 'Reavaliação',
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

export function validarAgendamento({ inicio, duracao, slots = [], ocupados = [], agora = Date.now() }) {
  const t = ms(inicio);
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
export function validarRegistro(d) {
  const r = {};
  for (const k of ['trabalhado', 'desenvolvido', 'orientacoes']) r[k] = String(d[k] || '').trim();
  const total = r.trabalhado.length + r.desenvolvido.length + r.orientacoes.length;
  if (total > LIMITES.texto) throw Error('O registro da consulta aceita até ' + LIMITES.texto + ' caracteres no total (agora: ' + total + ').');
  if (!r.trabalhado) throw Error('Descreva o que foi trabalhado no atendimento.');
  if (!TIPOS_ATENDIMENTO[d.tipo]) throw Error('Selecione o tipo de atendimento.');
  if (!EVOLUCAO[d.evolucao]) throw Error('Selecione a evolução observada.');
  return r;
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
