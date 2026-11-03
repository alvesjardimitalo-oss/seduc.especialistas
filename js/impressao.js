// Documentos para impressão / PDF (gerados no navegador, sem envio a terceiros).
// Layout A4 oficial: cabeçalho com os logotipos, faixa de título, ficha de identificação,
// seções numeradas e, em TODAS as páginas, rodapé com quem imprimiu, cargo, data, registro e "Página X de Y".
import { S, nomeEscola, escolaCurta } from './estado.js';
import { LOGO_SEDUC, logoEscola, cargoDe, ESCALA_META, SITUACAO_META, seriesDasMetas, ESPECIALIDADES, TIPOS_ATENDIMENTO, EVOLUCAO, formatarData, formatarDataHora, horaMunicipal, idade, ms, secoesRegistro } from './dominio.js';
import { esc, imprimir } from './ui.js';

const urlAbs = c => new URL(c, location.href).href;
const dataBR = d => d ? formatarData(d + 'T12:00:00-03:00') : '';
const cssTexto = t => '"' + String(t).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ') + '"';

// Código do registro de impressão (gravado em "acessos"), definido logo antes de imprimir.
let registro = '';
export const definirRegistro = cod => { registro = cod || ''; };

/**
 * Monta o documento completo: margens da página com rodapé em todas as folhas
 * (impresso por, cargo, data/hora, registro, paginação) e cabeçalho reduzido a partir da 2ª página.
 */
export function documento({ titulo, subtitulo = '', escolaId = '', corpo, aluno = '', lgpd = true }) {
  const quando = formatarDataHora(Date.now());
  const log = 'Impresso por ' + S.perfil.nome + ' — ' + cargoDe(S.perfil) + ' · ' + quando + (registro ? ' · Registro ' + registro : '');
  const topo = 'SEDUC Especialistas · ' + titulo + (aluno ? ' · ' + aluno : '');
  const estilo = '<style>@page { @bottom-left { content: ' + cssTexto(log) + '; } @bottom-right { content: "Página " counter(page) " de " counter(pages); } @top-left { content: ' + cssTexto(topo) + '; } }'
    + '@page :first { @top-left { content: none; } }</style>';
  const logo = escolaId ? logoEscola(S.escolas.find(x => x.id === escolaId)) : '';
  const cab = '<header class="doc-cab"><div class="doc-cab-linha"><img class="doc-logo" src="' + urlAbs(LOGO_SEDUC) + '" alt="SEDUC Frei Inocêncio">'
    + '<div class="doc-cab-txt"><strong>PREFEITURA MUNICIPAL DE FREI INOCÊNCIO/MG</strong><span>Secretaria Municipal de Educação</span><span>Atendimento Educacional Especializado</span>'
    + (escolaId ? '<em>' + esc(nomeEscola(escolaId)) + '</em>' : '') + '</div>'
    + (logo ? '<img class="doc-logo" src="' + urlAbs(logo) + '" alt="Logotipo da escola">' : '<span class="doc-logo"></span>') + '</div>'
    + '<div class="doc-titulo"><h1>' + esc(titulo) + '</h1>' + (subtitulo ? '<p>' + esc(subtitulo) + '</p>' : '') + '</div></header>';
  // Registro também no fim do documento (para quem imprime em navegador sem margens de página).
  const fim = '<footer class="doc-rodape"><div class="doc-log"><b>Impresso por:</b> ' + esc(S.perfil.nome) + ' — ' + esc(cargoDe(S.perfil)) + ' · <b>em</b> ' + esc(quando)
    + (registro ? ' · <b>Registro de impressão:</b> ' + esc(registro) : '') + '</div>'
    + (lgpd ? '<p>Documento com dados pessoais sensíveis de criança (LGPD, arts. 11 e 14). Uso restrito à finalidade do atendimento; não reproduza nem compartilhe fora dela.</p>' : '') + '</footer>';
  registro = '';
  return estilo + cab + corpo + fim;
}

const secao = (n, titulo, conteudo) => '<section class="doc-secao"><h2><span>' + n + '</span>' + esc(titulo) + '</h2>' + conteudo + '</section>';
const campoId = (rot, val, cls = '') => '<div class="id-campo ' + cls + '"><small>' + esc(rot) + '</small><b>' + (val ? esc(val) : '—') + '</b></div>';
const turnos = { manha: 'Manhã', tarde: 'Tarde', integral: 'Integral' };

/** Ficha de identificação do aluno, em quadros (como formulário oficial). */
function identificacao(e, privado = null) {
  const anos = idade(e.nascimento);
  return '<div class="doc-id">'
    + campoId('Aluno(a)', e.nome, 'largo3')
    + campoId('Nascimento', (dataBR(e.nascimento) || '') + (anos != null ? ' (' + anos + ' anos)' : ''))
    + campoId('Escola', nomeEscola(e.escola_id), 'largo2') + campoId('Turma', e.turma) + campoId('Turno', turnos[e.turno])
    + (privado && (privado.mae || privado.pai) ? campoId('Filiação', [privado.mae, privado.pai].filter(Boolean).join(' e '), 'largo3') + campoId('CPF', privado.cpf ? privado.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '') : '')
    + '</div>';
}
const assinatura = (nome, esp, reg) => '<div class="assinatura"><span></span><strong>' + esc(nome) + '</strong><small>' + esc(ESPECIALIDADES[esp] || '') + (reg ? ' · ' + esc(reg) : '') + '</small></div>';
const localData = t => '<p class="doc-local">Frei Inocêncio/MG, ' + esc(formatarData(t)) + '.</p>';
/** Texto livre em parágrafos; linhas curtas terminadas em ":" viram subtítulos e "•" vira lista. */
function paragrafos(texto) {
  const blocos = String(texto || '').replace(/\r/g, '').split(/\n{2,}/);
  return blocos.map(b => {
    const linhas = b.split('\n').filter(l => l.trim());
    if (!linhas.length) return '';
    if (linhas.length === 1 && /:\s*$/.test(linhas[0]) && linhas[0].length < 70) return '<h3>' + esc(linhas[0].replace(/:\s*$/, '')) + '</h3>';
    if (linhas.every(l => /^\s*[•\-–]/.test(l) || /^\s{2,}/.test(l))) return '<ul>' + linhas.map(l => '<li>' + esc(l.replace(/^\s*[•\-–]\s*/, '').trim()) + '</li>').join('') + '</ul>';
    const [primeira, ...resto] = linhas;
    if (/:\s*$/.test(primeira) && primeira.length < 70) return '<h3>' + esc(primeira.replace(/:\s*$/, '')) + '</h3><p>' + resto.map(esc).join('<br>') + '</p>';
    return '<p>' + linhas.map(esc).join('<br>') + '</p>';
  }).join('');
}

// ---------- prontuário ----------
export function imprimirProntuario({ estudante: e, privado, saude, atendimentos, registros, filtros, planos = [] }) {
  const profs = new Map();
  for (const a of atendimentos) profs.set(a.profissional_uid, a);
  const periodo = (filtros.especialidade ? ESPECIALIDADES[filtros.especialidade] : 'Todas as especialidades') + ' · '
    + (filtros.de ? 'de ' + dataBR(filtros.de) + ' ' : 'desde o início ') + (filtros.ate ? 'até ' + dataBR(filtros.ate) : '') + ' · ' + atendimentos.length + ' registro(s)';
  let n = 0, corpo = identificacao(e, privado);
  if (privado?.motivo_encaminhamento || saude?.necessidade_informada) {
    corpo += secao(++n, 'Encaminhamento e condição informada', '<dl class="doc-dl">'
      + (privado?.motivo_encaminhamento ? '<dt>Motivo do encaminhamento (escola)</dt><dd>' + esc(privado.motivo_encaminhamento) + '</dd>' : '')
      + (saude?.necessidade_informada ? '<dt>Condição informada</dt><dd>' + esc(saude.necessidade_informada) + (saude.fonte ? ' <small>(fonte: ' + esc(saude.fonte) + ')</small>' : '') + '</dd>' : '') + '</dl>');
  }
  for (const p of planos) {
    const series = seriesDasMetas(p.metas, atendimentos.filter(a => a.especialidade === p.especialidade), registros);
    corpo += secao(++n, 'Plano de acompanhamento — ' + ESPECIALIDADES[p.especialidade], '<table class="doc-tab"><thead><tr><th style="width:42%">Meta</th><th style="width:16%">Situação</th><th>Evolução (nota de 1 a 5 por consulta)</th></tr></thead><tbody>'
      + p.metas.map(m => '<tr><td>' + esc(m.texto) + '</td><td>' + esc(SITUACAO_META[m.situacao]) + '</td><td>' + (series[m.id].length
        ? '<span class="notas">' + series[m.id].map(x => '<i title="' + esc(formatarData(x.data)) + '">' + esc(formatarData(x.data).slice(0, 5)) + ' <b>' + x.nota + '</b></i>').join('') + '</span><small>Atual: ' + esc(ESCALA_META[series[m.id].at(-1).nota]) + '</small>' : '—') + '</td></tr>').join('')
      + '</tbody></table>');
  }
  const rotulo = t => { const m = /^([SOAP]) — (.*)$/.exec(t); return m ? '<b>' + m[1] + '</b><span>' + esc(m[2]) + '</span>' : '<span>' + esc(t) + '</span>'; };
  corpo += secao(++n, 'Registros de atendimento', atendimentos.length ? atendimentos.map(a => {
    const r = registros.get(a.id) || {};
    const linhas = secoesRegistro(r).map(([t, v]) => '<tr><th>' + rotulo(t) + '</th><td>' + esc(v) + '</td></tr>').join('');
    return '<article class="doc-reg esp-' + esc(a.especialidade) + '"><header><div><b>' + esc(formatarData(a.data)) + '</b> às ' + esc(horaMunicipal(a.data)) + ' · ' + a.duracao_min + ' min</div>'
      + '<div class="reg-esp">' + esc(ESPECIALIDADES[a.especialidade]) + '</div></header>'
      + '<div class="reg-meta"><span><small>Tipo</small>' + esc(TIPOS_ATENDIMENTO[a.tipo]) + '</span><span><small>Profissional</small>' + esc(a.profissional_nome) + '</span><span><small>Evolução</small>' + esc(EVOLUCAO[a.evolucao]) + '</span>'
      + '<span><small>Código</small>' + esc(a.codigo || '—') + (a.versao > 1 ? ' (retificado)' : '') + '</span></div>'
      + (linhas ? '<table class="reg-soap">' + linhas + '</table>' : '<p class="doc-nota">Sem texto registrado.</p>')
      + (a.orientacao_escola ? '<p class="reg-escola"><b>Orientação para a escola:</b> ' + esc(a.orientacao_escola) + '</p>' : '') + '</article>';
  }).join('') : '<p>Nenhum registro no período.</p>');
  corpo += localData(Date.now()) + '<div class="assinaturas">' + [...profs.values()].map(a => assinatura(a.profissional_nome, a.especialidade, S.usuarios.find(u => u.id === a.profissional_uid)?.registro_profissional)).join('') + '</div>';
  imprimir('Prontuário — ' + e.nome, documento({ titulo: 'Prontuário de acompanhamento especializado', subtitulo: periodo, escolaId: e.escola_id, corpo, aluno: e.nome }));
}

// ---------- relatório, parecer, devolutiva, encaminhamento ----------
const TIPOS_REL = { relatorio: 'Relatório de acompanhamento', parecer: 'Parecer', devolutiva: 'Devolutiva', encaminhamento: 'Encaminhamento' };
export function imprimirRelatorio(r, e) {
  const sub = [TIPOS_REL[r.tipo], ESPECIALIDADES[r.especialidade], r.periodo_de || r.periodo_ate ? 'Período: ' + dataBR(r.periodo_de) + ' a ' + dataBR(r.periodo_ate) : ''].filter(Boolean).join(' · ');
  const corpo = identificacao(e)
    + (r.destinatario ? '<p class="doc-dest"><b>Destinatário:</b> ' + esc(r.destinatario) + '</p>' : '')
    + '<div class="doc-texto">' + paragrafos(r.texto) + '</div>'
    + localData(r.criado_em) + '<div class="assinaturas">' + assinatura(r.profissional_nome, r.especialidade, r.registro_profissional) + '</div>';
  imprimir(r.titulo + ' — ' + e.nome, documento({ titulo: r.titulo || TIPOS_REL[r.tipo], subtitulo: sub, escolaId: e.escola_id, corpo, aluno: e.nome }));
}

// ---------- relatório gerencial (sem conteúdo clínico) ----------
export function imprimirGerencial(r, filtros, nomes) {
  const sub = 'Período: ' + (dataBR(filtros.de) || 'início') + ' a ' + (dataBR(filtros.ate) || 'hoje') + ' · ' + (filtros.escola ? escolaCurta(filtros.escola) : 'Todas as escolas')
    + (filtros.especialidade ? ' · ' + ESPECIALIDADES[filtros.especialidade] : '') + (filtros.profissional ? ' · ' + nomes.profissional : '');
  const card = (rot, v) => '<div class="kpi"><small>' + esc(rot) + '</small><b>' + v + '</b></div>';
  const corpo = '<div class="kpis">' + card('Atendimentos realizados', r.atendimentos) + card('Alunos atendidos', r.alunos) + card('Horas de atendimento', String(r.horas).replace('.', ',')) + card('Altas', r.altas) + '</div>'
    + secao(1, 'Por escola', '<table class="doc-tab"><thead><tr><th>Escola</th><th class="num">Alunos</th><th class="num">Atendimentos</th>' + Object.values(ESPECIALIDADES).map(n => '<th class="num">' + n + '</th>').join('') + '</tr></thead><tbody>'
      + Object.entries(r.porEscola).map(([id, e]) => '<tr><td>' + esc(escolaCurta(id)) + '</td><td class="num">' + e.alunos + '</td><td class="num">' + e.atendimentos + '</td>' + Object.keys(ESPECIALIDADES).map(k => '<td class="num">' + (e.porEspecialidade[k] || 0) + '</td>').join('') + '</tr>').join('') + '</tbody></table>')
    + secao(2, 'Por profissional', '<table class="doc-tab"><thead><tr><th>Profissional</th><th>Especialidade</th><th class="num">Atendimentos</th><th class="num">Alunos</th><th class="num">Horas</th></tr></thead><tbody>'
      + Object.values(r.porProfissional).map(p => '<tr><td>' + esc(p.nome) + '</td><td>' + esc(ESPECIALIDADES[p.especialidade]) + '</td><td class="num">' + p.atendimentos + '</td><td class="num">' + p.alunos + '</td><td class="num">' + String(Math.round(p.minutos / 6) / 10).replace('.', ',') + '</td></tr>').join('') + '</tbody></table>')
    + secao(3, 'Por tipo de atendimento', '<table class="doc-tab"><thead><tr><th>Tipo</th><th class="num">Quantidade</th></tr></thead><tbody>' + Object.entries(r.porTipo).sort((a, b) => b[1] - a[1]).map(([k, v]) => '<tr><td>' + esc(TIPOS_ATENDIMENTO[k] || k) + '</td><td class="num">' + v + '</td></tr>').join('') + '</tbody></table>')
    + '<p class="doc-nota">Relatório quantitativo: não contém registro clínico nem nomes de alunos.</p>';
  imprimir('Relatório gerencial', documento({ titulo: 'Relatório de atendimentos realizados', subtitulo: sub, escolaId: filtros.escola || '', corpo, lgpd: false }));
}

// ---------- ficha para a professora (sem registro clínico) ----------
export function imprimirFichaEscola({ estudante: e, atendimentos, agenda, condicao = '' }) {
  const validos = atendimentos.filter(a => a.situacao !== 'anulado').sort((a, b) => ms(b.data) - ms(a.data));
  const porEsp = new Map();
  for (const a of validos) if (!porEsp.has(a.especialidade)) porEsp.set(a.especialidade, a);
  const orient = validos.filter(a => a.orientacao_escola).slice(0, 6);
  const proximos = agenda.filter(a => a.status === 'agendado' && ms(a.inicio) > Date.now()).sort((a, b) => ms(a.inicio) - ms(b.inicio)).slice(0, 5);
  const corpo = identificacao(e)
    + (condicao ? '<p class="doc-dest"><b>Condição informada:</b> ' + esc(condicao) + '</p>' : '')
    + secao(1, 'Quem acompanha', porEsp.size ? '<table class="doc-tab"><thead><tr><th>Especialidade</th><th>Profissional</th><th>Último atendimento</th><th>Situação</th></tr></thead><tbody>'
      + [...porEsp.values()].map(a => '<tr><td>' + esc(ESPECIALIDADES[a.especialidade]) + '</td><td>' + esc(a.profissional_nome) + '</td><td>' + esc(formatarData(a.data)) + '</td><td>' + (a.tipo === 'alta' ? 'Alta' : 'Em acompanhamento') + '</td></tr>').join('') + '</tbody></table>' : '<p>Aguardando o primeiro atendimento.</p>')
    + secao(2, 'Orientações para a sala de aula', orient.length ? orient.map(a => '<div class="orientacao"><small>' + esc(formatarData(a.data)) + ' · ' + esc(a.profissional_nome) + ' (' + esc(ESPECIALIDADES[a.especialidade]) + ')</small><p>' + esc(a.orientacao_escola) + '</p></div>').join('') : '<p>Ainda não há orientações registradas.</p>')
    + secao(3, 'Próximos atendimentos', proximos.length ? '<table class="doc-tab"><thead><tr><th>Data e hora</th><th>Profissional</th><th>Especialidade</th></tr></thead><tbody>' + proximos.map(a => '<tr><td>' + esc(formatarDataHora(a.inicio)) + '</td><td>' + esc(a.profissional_nome) + '</td><td>' + esc(ESPECIALIDADES[a.especialidade]) + '</td></tr>').join('') + '</tbody></table>' : '<p>Nenhum agendado.</p>')
    + '<p class="doc-nota">Documento de uso interno da escola. Não contém registro clínico.</p>';
  imprimir('Ficha para a escola — ' + e.nome, documento({ titulo: 'Ficha de acompanhamento para a escola', escolaId: e.escola_id, corpo, aluno: e.nome }));
}
