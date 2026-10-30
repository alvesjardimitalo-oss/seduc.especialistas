// Documentos para impressão / PDF (gerados no navegador, sem envio a terceiros).
import { S, nomeEscola, escolaCurta } from './estado.js';
import { ESPECIALIDADES, TIPOS_ATENDIMENTO, EVOLUCAO, formatarData, formatarDataHora, idade } from './dominio.js';
import { esc, imprimir } from './ui.js';

const cabecalho = titulo => '<header class="doc-cab"><div><strong>Prefeitura Municipal de Frei Inocêncio/MG</strong><span>Secretaria Municipal de Educação · Atendimento Educacional Especializado</span></div><h1>' + esc(titulo) + '</h1></header>';
const dataBR = d => d ? formatarData(d + 'T12:00:00-03:00') : '';
const rodape = () => '<footer class="doc-rodape">Documento gerado em ' + esc(formatarDataHora(Date.now())) + ' por ' + esc(S.perfil.nome) + ' · SEDUC Especialistas. Contém dados pessoais sensíveis de criança (LGPD, arts. 11 e 14): uso restrito à finalidade do atendimento.</footer>';
const assinatura = (nome, esp, reg) => '<div class="assinatura"><span></span><strong>' + esc(nome) + '</strong><small>' + esc(ESPECIALIDADES[esp] || '') + (reg ? ' · ' + esc(reg) : '') + '</small></div>';

function identificacao(e) {
  const anos = idade(e.nascimento);
  return '<table class="doc-id"><tr><th>Aluno(a)</th><td colspan="3">' + esc(e.nome) + '</td></tr>'
    + '<tr><th>Nascimento</th><td>' + esc(dataBR(e.nascimento) || 'Não informado') + (anos != null ? ' (' + anos + ' anos)' : '') + '</td><th>Turma</th><td>' + esc(e.turma || '—') + '</td></tr>'
    + '<tr><th>Escola</th><td colspan="3">' + esc(nomeEscola(e.escola_id)) + '</td></tr></table>';
}

export function imprimirProntuario({ estudante: e, privado, saude, atendimentos, registros, filtros }) {
  const profs = new Map();
  for (const a of atendimentos) profs.set(a.profissional_uid, a);
  let h = cabecalho('Prontuário de acompanhamento especializado') + identificacao(e)
    + '<p class="doc-filtro">' + (filtros.especialidade ? ESPECIALIDADES[filtros.especialidade] : 'Todas as especialidades') + ' · ' + (filtros.de ? 'de ' + dataBR(filtros.de) + ' ' : '') + (filtros.ate ? 'até ' + dataBR(filtros.ate) : '') + ' · ' + atendimentos.length + ' registro(s)</p>';
  if (privado?.motivo_encaminhamento) h += '<h2>Motivo do encaminhamento</h2><p class="pre">' + esc(privado.motivo_encaminhamento) + '</p>';
  if (saude?.necessidade_informada) h += '<h2>Condição informada</h2><p class="pre">' + esc(saude.necessidade_informada) + (saude.fonte ? ' (fonte: ' + esc(saude.fonte) + ')' : '') + '</p>';
  h += '<h2>Registros de atendimento</h2>';
  h += atendimentos.length ? atendimentos.map(a => {
    const r = registros.get(a.id) || {};
    return '<article class="doc-reg"><header><strong>' + esc(formatarDataHora(a.data)) + '</strong> · ' + esc(TIPOS_ATENDIMENTO[a.tipo]) + ' · ' + esc(ESPECIALIDADES[a.especialidade]) + ' · ' + esc(a.profissional_nome) + ' · ' + a.duracao_min + ' min · Evolução: ' + esc(EVOLUCAO[a.evolucao]) + (a.versao > 1 ? ' · (retificado)' : '') + '</header>'
      + (r.trabalhado ? '<p><b>Trabalhado:</b> ' + esc(r.trabalhado) + '</p>' : '') + (r.desenvolvido ? '<p><b>Desenvolvido:</b> ' + esc(r.desenvolvido) + '</p>' : '') + (r.orientacoes ? '<p><b>Orientações:</b> ' + esc(r.orientacoes) + '</p>' : '') + '</article>';
  }).join('') : '<p>Nenhum registro no período.</p>';
  h += '<div class="assinaturas">' + [...profs.values()].map(a => assinatura(a.profissional_nome, a.especialidade, S.usuarios.find(u => u.id === a.profissional_uid)?.registro_profissional)).join('') + '</div>' + rodape();
  imprimir('Prontuário — ' + e.nome, h);
}

const TIPOS_REL = { relatorio: 'Relatório de acompanhamento', parecer: 'Parecer', devolutiva: 'Devolutiva', encaminhamento: 'Encaminhamento' };
export function imprimirRelatorio(r, e) {
  const h = cabecalho(r.titulo || TIPOS_REL[r.tipo]) + identificacao(e)
    + '<p class="doc-filtro">' + esc(TIPOS_REL[r.tipo]) + ' · ' + esc(ESPECIALIDADES[r.especialidade]) + (r.periodo_de || r.periodo_ate ? ' · Período: ' + esc(dataBR(r.periodo_de)) + ' a ' + esc(dataBR(r.periodo_ate)) : '') + (r.destinatario ? ' · Destinatário: ' + esc(r.destinatario) : '') + '</p>'
    + '<div class="pre doc-texto">' + esc(r.texto) + '</div>'
    + '<p class="doc-local">Frei Inocêncio/MG, ' + esc(formatarData(r.criado_em)) + '.</p>'
    + '<div class="assinaturas">' + assinatura(r.profissional_nome, r.especialidade, r.registro_profissional) + '</div>' + rodape();
  imprimir(r.titulo + ' — ' + e.nome, h);
}

export function imprimirGerencial(r, filtros, nomes) {
  const linha = (k, v) => '<tr><td>' + esc(k) + '</td><td class="num">' + v + '</td></tr>';
  let h = cabecalho('Relatório gerencial do atendimento especializado')
    + '<p class="doc-filtro">Período: ' + esc(dataBR(filtros.de) || 'início') + ' a ' + esc(dataBR(filtros.ate) || 'hoje')
    + (filtros.escola ? ' · ' + esc(escolaCurta(filtros.escola)) : ' · Todas as escolas') + (filtros.especialidade ? ' · ' + esc(ESPECIALIDADES[filtros.especialidade]) : '') + (filtros.profissional ? ' · ' + esc(nomes.profissional) : '') + '</p>'
    + '<table class="doc-tab"><tbody>' + linha('Atendimentos realizados', r.atendimentos) + linha('Alunos atendidos (distintos)', r.alunos) + linha('Horas de atendimento', r.horas) + linha('Faltas de alunos', r.faltas) + linha('Agendamentos cancelados', r.cancelados) + linha('Altas', r.altas) + '</tbody></table>'
    + '<h2>Por escola</h2><table class="doc-tab"><thead><tr><th>Escola</th><th>Alunos</th><th>Atendimentos</th>' + Object.values(ESPECIALIDADES).map(n => '<th>' + n + '</th>').join('') + '</tr></thead><tbody>'
    + Object.entries(r.porEscola).map(([id, e]) => '<tr><td>' + esc(escolaCurta(id)) + '</td><td class="num">' + e.alunos + '</td><td class="num">' + e.atendimentos + '</td>' + Object.keys(ESPECIALIDADES).map(k => '<td class="num">' + (e.porEspecialidade[k] || 0) + '</td>').join('') + '</tr>').join('') + '</tbody></table>'
    + '<h2>Por profissional</h2><table class="doc-tab"><thead><tr><th>Profissional</th><th>Especialidade</th><th>Atendimentos</th><th>Alunos</th><th>Horas</th><th>Faltas</th></tr></thead><tbody>'
    + Object.values(r.porProfissional).map(p => '<tr><td>' + esc(p.nome) + '</td><td>' + esc(ESPECIALIDADES[p.especialidade]) + '</td><td class="num">' + p.atendimentos + '</td><td class="num">' + p.alunos + '</td><td class="num">' + (Math.round(p.minutos / 6) / 10) + '</td><td class="num">' + (p.faltas || 0) + '</td></tr>').join('') + '</tbody></table>'
    + '<h2>Por tipo de atendimento</h2><table class="doc-tab"><tbody>' + Object.entries(r.porTipo).map(([k, v]) => linha(TIPOS_ATENDIMENTO[k] || k, v)).join('') + '</tbody></table>'
    + '<p class="doc-nota">Relatório quantitativo, sem conteúdo clínico.</p>' + rodape();
  imprimir('Relatório gerencial', h);
}
