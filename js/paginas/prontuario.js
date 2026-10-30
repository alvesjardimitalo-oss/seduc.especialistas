// Prontuário do aluno: linha do tempo compartilhada em cards expansíveis.
import * as dados from '../dados.js';
import { S, pode, nomeEscola, escolaCurta, estudante } from '../estado.js';
import { formAtendimento, formAgendar, formAluno, arquivarAluno, anularAtendimento, abrirAgendamento, irPara, eventos } from '../formularios.js';
import {
  ESPECIALIDADES, TIPOS_ATENDIMENTO, EVOLUCAO, STATUS_AGENDA, linhaDoTempo, situacaoAcompanhamento, idade,
  formatarData, formatarDataHora, diaMunicipal, ms, noPeriodo, formatarCPF, secoesRegistro, planoDoRegistro, validarCondicao, ordenarCondicoes
} from '../dominio.js';
import { esc, iniciais, vazio, modal, campo, area, opcoes, ativarContadores, aviso, erro, $, $$ } from '../ui.js';
import { chipsAcompanhamento } from './alunos.js';
import { imprimirProntuario, imprimirRelatorio, imprimirFichaEscola } from '../impressao.js';

const ABAS = [['prontuario', 'Prontuário'], ['agenda', 'Agenda'], ['relatorios', 'Relatórios'], ['ficha', 'Ficha cadastral']];
let filtroEsp = '', mostrarAnulados = false;

export async function render(main, vigente) {
  const id = S.rota.id, e = estudante(id);
  if (!e) { main.innerHTML = '<div class="alerta-caixa erro">Aluno não encontrado ou fora do seu acesso.</div><a href="#/alunos" class="btn sec">← Voltar</a>'; return; }
  const aba = ABAS.some(([k]) => k === S.rota.aba) ? S.rota.aba : 'prontuario';
  const clinico = pode.clinico();
  const veContato = clinico || pode.gerenciar() || S.perfil.perfil === 'direcao';
  const [atendimentos, registros, agenda, privado, saude, relatorios, condicoes] = await Promise.all([
    dados.listarAtendimentos({ estudanteId: id }),
    clinico ? dados.listarRegistros(id) : [],
    dados.listarAgendamentos({ estudanteId: id }),
    veContato ? dados.lerDoc('estudantes_privado', id).then(x => x || {}).catch(() => null) : null,
    clinico ? dados.lerDoc('estudantes_clinico', id).catch(() => null) : null,
    clinico ? dados.listarRelatorios(id) : [],
    clinico ? dados.listarCondicoes(id).catch(() => []) : []
  ]);
  if (!vigente()) return;
  const reg = new Map(registros.map(r => [r.id, r]));
  const sit = atendimentos.length ? situacaoAcompanhamento(atendimentos) : null;
  const anos = idade(e.nascimento);
  const proximo = agenda.filter(a => a.status === 'agendado' && ms(a.inicio) > Date.now()).sort((a, b) => ms(a.inicio) - ms(b.inicio))[0];

  let h = '<a href="#/alunos" class="voltar">← Alunos</a>'
    + '<header class="perfil-topo"><div class="perfil-id"><span class="avatar grande">' + esc(iniciais(e.nome)) + '</span><div>'
    + '<h1>' + esc(e.nome) + '</h1>'
    + '<p>' + [anos != null ? anos + ' anos' : '', esc(nomeEscola(e.escola_id)), e.turma ? esc(e.turma) : '', e.turno ? { manha: 'Manhã', tarde: 'Tarde', integral: 'Integral' }[e.turno] : ''].filter(Boolean).join(' · ') + '</p>'
    + '<div class="chips">' + (e.situacao === 'arquivado' ? '<span class="chip arquivado">Arquivado</span>' : '') + chipsAcompanhamento(sit) + '</div></div></div>'
    + '<div class="acoes-linha">'
    + (pode.registrar() && e.situacao !== 'arquivado' ? '<button class="btn" data-acao="registrar">+ Registrar atendimento</button>' : '')
    + (pode.agendar() && e.situacao !== 'arquivado' ? '<button class="btn sec" data-acao="agendar">Agendar</button>' : '')
    + '<button class="btn sec" data-acao="ficha-escola">Ficha para a professora</button>'
    + (clinico ? '<button class="btn sec" data-acao="imprimir">Imprimir prontuário</button>' : '')
    + '</div></header>'
    + (proximo ? '<div class="faixa-proximo">Próximo atendimento: <strong>' + esc(formatarDataHora(proximo.inicio)) + '</strong> com ' + esc(proximo.profissional_nome) + ' (' + esc(ESPECIALIDADES[proximo.especialidade]) + ')</div>' : '')
    + '<nav class="abas" role="tablist">' + ABAS.filter(([k]) => k !== 'relatorios' || clinico).map(([k, t]) => '<a role="tab" href="#/aluno/' + esc(id) + '/' + k + '" aria-selected="' + (aba === k) + '" class="' + (aba === k ? 'ativa' : '') + '">' + t
      + (k === 'prontuario' ? ' <span class="contagem">' + atendimentos.filter(a => a.situacao !== 'anulado').length + '</span>' : '')
      + (k === 'relatorios' ? ' <span class="contagem">' + relatorios.length + '</span>' : '') + '</a>').join('') + '</nav>';

  if (aba === 'prontuario') h += abaProntuario(e, atendimentos, reg, privado, saude, clinico, condicoes);
  if (aba === 'agenda') h += abaAgenda(agenda);
  if (aba === 'relatorios') h += abaRelatorios(relatorios);
  if (aba === 'ficha') h += abaFicha(e, privado, saude, clinico);
  main.innerHTML = h;

  // ações
  $$('[data-acao]', main).forEach(b => b.onclick = () => {
    const a = b.dataset.acao;
    if (a === 'registrar') formAtendimento({ estudanteId: id });
    if (a === 'agendar') formAgendar({ estudanteId: id });
    if (a === 'imprimir') opcoesImpressao(e, atendimentos, reg, privado, saude);
    if (a === 'ficha-escola') fichaEscola(e, atendimentos, agenda, saude, clinico);
    if (a === 'nova-condicao') novaCondicao(e);
    if (a === 'editar') formAluno(id);
    if (a === 'arquivar') arquivarAluno(id);
    if (a === 'relatorio') formRelatorio(e, atendimentos, reg);
  });
  $$('[data-condicao]', main).forEach(b => b.onclick = () => {
    const c = condicoes.find(x => x.id === b.dataset.condicao), para = b.dataset.para;
    modal({ titulo: para === 'resolvido' ? 'Marcar como resolvido' : 'Reativar', botao: 'Confirmar',
      corpo: '<p><strong>' + esc(c.descricao) + '</strong></p>' + area('observacao', 'Observação (opcional)', { valor: c.observacao, max: 300, linhas: 2, dica: para === 'resolvido' ? 'Ex.: alta fonoaudiológica; objetivo atingido' : '' }),
      aoSalvar: async d => { await dados.mudarSituacaoCondicao(c.id, para, d.observacao.trim()); aviso(para === 'resolvido' ? 'Marcado como resolvido.' : 'Reativado.'); render(main, vigente); } });
  });
  $$('[data-filtro-esp]', main).forEach(b => b.onclick = () => { filtroEsp = b.dataset.filtroEsp; render(main, vigente); });
  $('#mostrar-anulados', main)?.addEventListener('change', ev => { mostrarAnulados = ev.target.checked; render(main, vigente); });
  $$('[data-retificar]', main).forEach(b => b.onclick = () => { const a = atendimentos.find(x => x.id === b.dataset.retificar); formAtendimento({ atendimento: a, registro: reg.get(a.id) }); });
  $$('[data-anular]', main).forEach(b => b.onclick = () => anularAtendimento(atendimentos.find(x => x.id === b.dataset.anular)));
  $$('[data-versoes]', main).forEach(b => b.onclick = () => verVersoes(b.dataset.versoes));
  $$('[data-agendamento]', main).forEach(b => b.onclick = () => abrirAgendamento(agenda.find(x => x.id === b.dataset.agendamento)));
  $$('[data-imprimir-rel]', main).forEach(b => b.onclick = () => imprimirRelatorio(relatorios.find(r => r.id === b.dataset.imprimirRel), e));
  $('[data-expandir-todos]', main)?.addEventListener('click', ev => { const abrir = ev.target.dataset.expandirTodos !== '1'; $$('.card-atendimento', main).forEach(d => d.open = abrir); ev.target.dataset.expandirTodos = abrir ? '1' : '0'; ev.target.textContent = abrir ? 'Recolher todos' : 'Expandir todos'; });
}

// ---------- aba prontuário ----------
function abaProntuario(e, atendimentos, reg, privado, saude, clinico, condicoes = []) {
  const sit = situacaoAcompanhamento(atendimentos);
  // ---------- Folha de rosto (como no PEC) ----------
  const ultimosPorProf = new Map();
  for (const a of atendimentos.filter(x => x.situacao !== 'anulado').sort((x, y) => ms(y.data) - ms(x.data))) if (!ultimosPorProf.has(a.profissional_uid)) ultimosPorProf.set(a.profissional_uid, a);
  const ativos = ordenarCondicoes(condicoes).filter(c => c.situacao === 'ativo'), resolvidos = ordenarCondicoes(condicoes).filter(c => c.situacao !== 'ativo');
  const linhaCond = c => '<li class="cond cond-' + esc(c.situacao) + '"><div><strong>' + esc(c.descricao) + '</strong><small>' + esc(ESPECIALIDADES[c.especialidade] || '') + ' · desde ' + esc(formatarData(c.criado_em)) + (c.situacao === 'resolvido' && c.resolvido_em ? ' · resolvido em ' + esc(formatarData(c.resolvido_em)) : '') + '</small>' + (c.observacao ? '<span>' + esc(c.observacao) + '</span>' : '') + '</div>'
    + (pode.registrar() ? '<button type="button" class="link" data-condicao="' + esc(c.id) + '" data-para="' + (c.situacao === 'ativo' ? 'resolvido' : 'ativo') + '">' + (c.situacao === 'ativo' ? 'Marcar resolvido' : 'Reativar') + '</button>' : '') + '</li>';
  let h = '<section class="cartao folha-rosto"><header class="cartao-topo"><h2>Folha de rosto</h2>' + (e.situacao !== 'arquivado' && pode.registrar() ? '<button class="btn sec pequeno" data-acao="nova-condicao">+ Problema / condição</button>' : '') + '</header><div class="folha-grade">';
  // coluna 1: problemas e condições + encaminhamento
  h += '<div class="folha-col"><h3>Problemas e condições</h3>'
    + (clinico ? (ativos.length ? '<ul class="lista-cond">' + ativos.map(linhaCond).join('') + '</ul>' : '<p class="nota">Nenhum problema ou condição ativa registrada pela equipe.</p>')
      + (resolvidos.length ? '<details class="resolvidos"><summary>Resolvidos (' + resolvidos.length + ')</summary><ul class="lista-cond">' + resolvidos.map(linhaCond).join('') + '</ul></details>' : '')
      + (saude?.necessidade_informada ? '<p class="cond-escola"><b>Informado pela escola:</b> ' + esc(saude.necessidade_informada) + (saude.fonte ? ' <small class="nota">(' + esc(saude.fonte) + ')</small>' : '') + '</p>' : '')
      + (saude?.observacoes ? '<p class="nota texto">' + esc(saude.observacoes) + '</p>' : '')
      : '<p class="nota">Restrito à equipe de especialistas.</p>')
    + '<h3>Encaminhamento da escola</h3>' + (privado?.motivo_encaminhamento ? '<p class="texto">' + esc(privado.motivo_encaminhamento) + '</p>' : '<p class="nota">Não informado.</p>') + '</div>';
  // coluna 2: acompanhamentos ativos
  h += '<div class="folha-col"><h3>Acompanhamentos</h3><div class="esp-resumo">'
    + Object.entries(ESPECIALIDADES).map(([k, nome]) => {
      const p = sit.porEspecialidade[k];
      if (!p) return '<div class="esp-item esp-' + k + ' inativo"><strong>' + nome + '</strong><span>Sem atendimentos</span></div>';
      const primeiro = atendimentos.filter(a => a.especialidade === k && a.situacao !== 'anulado').sort((a, b) => ms(a.data) - ms(b.data))[0];
      return '<div class="esp-item esp-' + k + '"><strong>' + nome + '</strong>'
        + '<span>' + (p.ultimo.tipo === 'alta' ? 'Alta em ' + formatarData(p.ultimo.data) : 'Em acompanhamento desde ' + formatarData(primeiro.data)) + ' · ' + p.total + ' registro(s)</span>'
        + '<span>' + esc(p.ultimo.profissional_nome) + ' · último em ' + formatarData(p.ultimo.data) + '</span>'
        + '<span class="evo evo-' + esc(p.ultimo.evolucao) + '">Evolução: ' + esc(EVOLUCAO[p.ultimo.evolucao]) + '</span></div>';
    }).join('') + '</div></div>';
  // coluna 3: últimas orientações de cada profissional
  h += '<div class="folha-col"><h3>Últimas orientações</h3>' + (ultimosPorProf.size ? [...ultimosPorProf.values()].map(a => {
    const plano = clinico ? planoDoRegistro(reg.get(a.id)) : '';
    return '<div class="orient-prof esp-' + esc(a.especialidade) + '"><strong>' + esc(a.profissional_nome) + '</strong><small>' + esc(ESPECIALIDADES[a.especialidade]) + ' · ' + esc(formatarData(a.data)) + '</small>'
      + (plano ? '<p><b>Plano:</b> ' + esc(plano) + '</p>' : '') + (a.orientacao_escola ? '<p><b>Para a escola:</b> ' + esc(a.orientacao_escola) + '</p>' : '')
      + (!plano && !a.orientacao_escola ? '<p class="nota">Sem orientação registrada.</p>' : '') + '</div>';
  }).join('') : '<p class="nota">Ainda sem atendimentos.</p>') + '</div>';
  h += '</div></section>';

  const lista = linhaDoTempo(atendimentos, { especialidade: filtroEsp, incluirAnulados: mostrarAnulados });
  h += '<section class="linha-tempo"><header class="cartao-topo"><h2>Linha do tempo</h2><div class="filtro-chips">'
    + [['', 'Todas'], ...Object.entries(ESPECIALIDADES)].map(([k, n]) => '<button type="button" class="chip-btn' + (filtroEsp === k ? ' ativo' : '') + (k ? ' esp-' + k : '') + '" data-filtro-esp="' + k + '">' + n + '</button>').join('')
    + '<label class="check"><input type="checkbox" id="mostrar-anulados"' + (mostrarAnulados ? ' checked' : '') + '> Mostrar anulados</label>'
    + (lista.length ? '<button type="button" class="link" data-expandir-todos="0">Expandir todos</button>' : '') + '</div></header>';
  if (!clinico) h += '<p class="nota">O conteúdo dos atendimentos é restrito à equipe de especialistas. Aqui aparecem data, profissional, tipo e evolução.</p>';
  h += lista.length ? lista.map((a, i) => cardAtendimento(a, reg.get(a.id), clinico, i === 0)).join('')
    : vazio('Nenhum atendimento registrado' + (filtroEsp ? ' em ' + ESPECIALIDADES[filtroEsp] : '') + '.', pode.registrar() ? 'Use "Registrar atendimento" para iniciar o prontuário.' : '');
  return h + '</section>';
}

function cardAtendimento(a, r, clinico, aberto) {
  const anulado = a.situacao === 'anulado', autor = a.profissional_uid === S.user.uid;
  const txtPrev = r ? (r.objetivo || r.trabalhado || r.subjetivo || '') : '';
  const previa = txtPrev ? txtPrev.replace(/\s+/g, ' ').slice(0, 150) + (txtPrev.length > 150 ? '…' : '') : '';
  const secao = (t, v) => v ? '<div class="secao"><h4>' + t + '</h4><p>' + esc(v) + '</p></div>' : '';
  return '<details class="card-atendimento esp-' + esc(a.especialidade) + (anulado ? ' anulado' : '') + '"' + (aberto && clinico && !anulado ? ' open' : '') + '>'
    + '<summary><span class="card-data"><b>' + esc(formatarData(a.data).slice(0, 5)) + '</b><small>' + esc(formatarData(a.data).slice(6)) + '</small></span>'
    + '<span class="card-info"><span class="card-linha1"><strong>' + esc(TIPOS_ATENDIMENTO[a.tipo]) + '</strong><span class="tag-esp esp-' + esc(a.especialidade) + '">' + esc(ESPECIALIDADES[a.especialidade]) + '</span>'
    + (anulado ? '<span class="selo s-cancelado">Anulado</span>' : '<span class="evo evo-' + esc(a.evolucao) + '">' + esc(EVOLUCAO[a.evolucao]) + '</span>') + '</span>'
    + '<small>' + esc(a.profissional_nome) + ' · ' + esc(formatarDataHora(a.data).slice(11)) + ' · ' + a.duracao_min + ' min' + (a.codigo ? ' · ' + esc(a.codigo) : '') + (a.versao > 1 && !anulado ? ' · editada' : '') + '</small>'
    + (previa ? '<span class="previa">' + esc(previa) + '</span>' : '') + '</span><span class="seta" aria-hidden="true">⌄</span></summary>'
    + '<div class="card-corpo">'
    + (anulado ? '<p class="alerta-caixa aviso">Registro anulado: ' + esc(a.motivo_anulacao) + '</p>' : '')
    + (clinico ? (r ? secoesRegistro(r).map(([t, v]) => secao(t, v)).join('') : '<p class="nota">Texto indisponível.</p>')
      : '<p class="nota">O registro clínico é restrito à equipe de especialistas.</p>')
    + (a.orientacao_escola && !anulado ? '<div class="orientacao-escola"><h4>Orientação para a professora / escola</h4><p>' + esc(a.orientacao_escola) + '</p></div>' : '')
    + (clinico ? '<div class="acoes-linha pequeno">'
      + (autor && !anulado && pode.registrar() ? '<button type="button" class="btn sec pequeno" data-retificar="' + esc(a.id) + '">Editar</button>' : '')
      + ((autor || pode.admin()) && !anulado ? '<button type="button" class="btn sec pequeno perigo" data-anular="' + esc(a.id) + '">Anular</button>' : '')
      + (a.versao > 1 ? '<button type="button" class="link" data-versoes="' + esc(a.id) + '">Ver versões anteriores</button>' : '') + '</div>' : '')
    + '</div></details>';
}

async function verVersoes(id) {
  try {
    const vs = (await dados.listarVersoes(id)).sort((a, b) => b.versao - a.versao);
    modal({
      titulo: 'Versões anteriores', somenteLeitura: true, largo: true,
      corpo: vs.length ? vs.map(v => '<article class="versao"><header><strong>Versão ' + v.versao + '</strong> · alterada em ' + esc(formatarDataHora(v.em)) + '</header><p><em>Motivo da alteração:</em> ' + esc(v.motivo) + '</p>'
        + '<p class="nota">' + esc(TIPOS_ATENDIMENTO[v.atendimento.tipo]) + ' · ' + esc(formatarDataHora(v.atendimento.data)) + ' · ' + esc(EVOLUCAO[v.atendimento.evolucao]) + '</p>'
        + secoesRegistro(v.registro || {}).map(([t, x]) => '<p class="texto"><b>' + esc(t) + ':</b> ' + esc(x) + '</p>').join('') + '</article>').join('') : vazio('Sem versões anteriores.')
    });
  } catch (e) { erro(e); }
}

// ---------- aba agenda ----------
function abaAgenda(agenda) {
  const futuros = agenda.filter(a => a.status === 'agendado').sort((a, b) => ms(a.inicio) - ms(b.inicio));
  const passados = agenda.filter(a => a.status !== 'agendado').sort((a, b) => ms(b.inicio) - ms(a.inicio));
  const linha = a => '<button type="button" class="linha-agenda s-' + esc(a.status) + '" data-agendamento="' + esc(a.id) + '"><span class="hora">' + esc(formatarData(a.inicio).slice(0, 5)) + '<small>' + esc(formatarDataHora(a.inicio).slice(11)) + '</small></span><span class="quem"><strong>' + esc(a.profissional_nome) + '</strong><small>' + esc(ESPECIALIDADES[a.especialidade]) + ' · ' + esc(escolaCurta(a.escola_id)) + (a.codigo ? ' · ' + esc(a.codigo) : '') + '</small></span><span class="selo s-' + esc(a.status) + '">' + esc(STATUS_AGENDA[a.status]) + '</span></button>';
  return '<section class="cartao"><header class="cartao-topo"><h2>Agendados</h2>' + (pode.agendar() ? '<button class="btn sec" data-acao="agendar">Agendar</button>' : '') + '</header>'
    + (futuros.length ? '<div class="lista-agenda">' + futuros.map(linha).join('') + '</div>' : vazio('Nenhum agendamento futuro.'))
    + '<h3 class="subtitulo">Histórico da agenda</h3>' + (passados.length ? '<div class="lista-agenda">' + passados.map(linha).join('') + '</div>' : vazio('Sem histórico.'))
    + '<p class="nota">Faltas: ' + agenda.filter(a => a.status === 'falta').length + ' · Cancelamentos: ' + agenda.filter(a => a.status === 'cancelado').length + '</p></section>';
}

// ---------- aba relatórios ----------
const TIPOS_REL = { relatorio: 'Relatório de acompanhamento', parecer: 'Parecer', devolutiva: 'Devolutiva à família/escola', encaminhamento: 'Encaminhamento' };
function abaRelatorios(relatorios) {
  const lista = relatorios.slice().sort((a, b) => ms(b.criado_em) - ms(a.criado_em));
  return '<section class="cartao"><header class="cartao-topo"><h2>Documentos emitidos</h2>' + (pode.registrar() ? '<button class="btn" data-acao="relatorio">+ Emitir relatório</button>' : '') + '</header>'
    + '<p class="nota">Relatórios, pareceres e devolutivas ficam guardados aqui com autoria e data. Documentos emitidos não são alterados: para complementar, emita um novo.</p>'
    + (lista.length ? lista.map(r => '<details class="card-atendimento esp-' + esc(r.especialidade) + '"><summary><span class="card-data"><b>' + esc(formatarData(r.criado_em).slice(0, 5)) + '</b><small>' + esc(formatarData(r.criado_em).slice(6)) + '</small></span><span class="card-info"><span class="card-linha1"><strong>' + esc(r.titulo) + '</strong><span class="tag-esp esp-' + esc(r.especialidade) + '">' + esc(TIPOS_REL[r.tipo]) + '</span></span><small>' + esc(r.profissional_nome) + ' · ' + esc(ESPECIALIDADES[r.especialidade]) + (r.destinatario ? ' · Para: ' + esc(r.destinatario) : '') + '</small></span><span class="seta">⌄</span></summary><div class="card-corpo"><div class="secao"><p>' + esc(r.texto) + '</p></div><div class="acoes-linha pequeno"><button type="button" class="btn sec pequeno" data-imprimir-rel="' + esc(r.id) + '">Imprimir / salvar PDF</button></div></div></details>').join('')
      : vazio('Nenhum documento emitido.'))
    + '</section>';
}

function formRelatorio(e, atendimentos, reg) {
  const hoje = diaMunicipal(Date.now()), ini = hoje.slice(0, 4) + '-01-01';
  const form = modal({
    titulo: 'Emitir relatório — ' + e.nome, largo: true, botao: 'Emitir relatório',
    corpo: '<div class="grade">' + opcoes('tipo', 'Tipo de documento', TIPOS_REL, { obrig: true })
      + campo('titulo', 'Título', { obrig: true, valor: 'Relatório de acompanhamento em ' + ESPECIALIDADES[S.perfil.especialidade], extra: 'maxlength="150"', largo: true })
      + campo('destinatario', 'Destinatário', { extra: 'maxlength="180"', dica: 'Ex.: Família; Direção da escola; Neuropediatra' })
      + campo('registro_profissional', 'Registro profissional', { valor: S.perfil.registro_profissional || '', extra: 'maxlength="60"', dica: 'CRFa / CRP / ABPp' })
      + campo('periodo_de', 'Período de', { tipo: 'date', valor: ini }) + campo('periodo_ate', 'até', { tipo: 'date', valor: hoje }) + '</div>'
      + '<button type="button" class="btn sec pequeno" id="preencher">Preencher com meus atendimentos do período</button>'
      + area('texto', 'Texto do relatório', { obrig: true, max: 10000, linhas: 14 })
      + '<p class="nota">Revise o texto antes de emitir. Depois de emitido o documento não é alterado.</p>',
    aoSalvar: async d => {
      if (d.periodo_de && d.periodo_ate && d.periodo_de > d.periodo_ate) throw Error('O período final deve ser após o inicial.');
      await dados.emitirRelatorio({ estudante_id: e.id, escola_id: e.escola_id, profissional_nome: S.perfil.nome, especialidade: S.perfil.especialidade, registro_profissional: d.registro_profissional.trim(), tipo: d.tipo, titulo: d.titulo.trim(), destinatario: d.destinatario.trim(), periodo_de: d.periodo_de, periodo_ate: d.periodo_ate, texto: d.texto.trim() });
      aviso('Relatório emitido.'); irPara('#/aluno/' + e.id + '/relatorios');
    }
  });
  ativarContadores(form);
  $('#preencher', form).onclick = () => {
    const meus = linhaDoTempo(atendimentos, { especialidade: S.perfil.especialidade, incluirAnulados: false })
      .filter(a => noPeriodo(a.data, form.periodo_de.value, form.periodo_ate.value)).reverse();
    if (!meus.length) return aviso('Não há atendimentos de ' + ESPECIALIDADES[S.perfil.especialidade] + ' no período.', 'erro');
    const linhas = ['Aluno(a): ' + e.nome + (e.nascimento ? ', nascido(a) em ' + formatarData(e.nascimento + 'T12:00:00-03:00') : '') + ', matriculado(a) na ' + nomeEscola(e.escola_id) + (e.turma ? ', ' + e.turma : '') + '.',
      '', 'Período: ' + formatarData(form.periodo_de.value + 'T12:00:00-03:00') + ' a ' + formatarData(form.periodo_ate.value + 'T12:00:00-03:00') + ' — ' + meus.length + ' atendimento(s).', '', 'Síntese dos atendimentos:'];
    for (const a of meus) {
      const r = reg.get(a.id);
      linhas.push('', '• ' + formatarData(a.data) + ' — ' + TIPOS_ATENDIMENTO[a.tipo] + ' (evolução: ' + EVOLUCAO[a.evolucao].toLowerCase() + ')');
      for (const [t, v] of secoesRegistro(r || {})) linhas.push('  ' + t.replace(/^[SOAP] — /, '') + ': ' + v);

    }
    linhas.push('', 'Considerações e orientações:', '');
    form.texto.value = linhas.join('\n').slice(0, 10000); form.texto.dispatchEvent(new Event('input'));
  };
}

// ---------- aba ficha ----------
function abaFicha(e, privado, saude, clinico) {
  const item = (k, v) => '<div><dt>' + k + '</dt><dd>' + (v ? esc(v) : '<span class="nota">Não informado</span>') + '</dd></div>';
  return '<section class="cartao"><header class="cartao-topo"><h2>Dados do aluno</h2><div class="acoes-linha">'
    + (pode.cadastrarAluno() ? '<button class="btn sec" data-acao="editar">Editar cadastro</button>' : '')
    + (pode.cadastrarAluno() && S.perfil.perfil !== 'direcao' ? '<button class="btn sec" data-acao="arquivar">' + (e.situacao === 'arquivado' ? 'Reativar' : 'Arquivar') + '</button>' : '') + '</div></header>'
    + '<dl class="ficha-dados">' + item('Nome', e.nome) + item('Nascimento', e.nascimento ? formatarData(e.nascimento + 'T12:00:00-03:00') : '') + item('Escola', nomeEscola(e.escola_id))
    + item('Turma', e.turma) + item('Turno', { manha: 'Manhã', tarde: 'Tarde', integral: 'Integral' }[e.turno]) + item('Ano letivo', String(e.ano_letivo || ''))
    + item('Situação', e.situacao === 'arquivado' ? 'Arquivado — ' + (e.motivo_arquivamento || '') : 'Ativo')
    + ((e.escolas_anteriores || []).length ? item('Escolas anteriores', e.escolas_anteriores.map(x => nomeEscola(x.escola_id) + ' (até ' + formatarData(x.ate + 'T12:00:00-03:00') + ')').join('; ')) : '')
    + '</dl></section>'
    + (privado !== null ? '<section class="cartao"><h2>Filiação e contato</h2><dl class="ficha-dados">' + item('Mãe', privado?.mae ?? '') + item('Pai', privado?.pai ?? '') + (privado?.responsavel ? item('Responsável (cadastro anterior)', privado.responsavel + (privado.parentesco ? ' — ' + privado.parentesco : '')) : '') + item('Telefone', privado?.telefone) + item('Endereço', privado?.endereco) + item('Cartão SUS', privado?.cartao_sus) + item('CPF', formatarCPF(privado?.cpf)) + '</dl></section>' : '')
    + (clinico ? '<section class="cartao"><h2>Informações de saúde</h2><dl class="ficha-dados">' + item('Condição informada', saude?.necessidade_informada) + item('Fonte', saude?.fonte) + item('Observações', saude?.observacoes) + '</dl></section>' : '');
}

function opcoesImpressao(e, atendimentos, reg, privado, saude) {
  const hoje = diaMunicipal(Date.now());
  modal({
    titulo: 'Imprimir prontuário', botao: 'Gerar documento',
    corpo: '<div class="grade">' + opcoes('especialidade', 'Especialidade', [['', 'Todas'], ...Object.entries(ESPECIALIDADES)]) + campo('de', 'De', { tipo: 'date' }) + campo('ate', 'Até', { tipo: 'date', valor: hoje }) + '</div><p class="nota">O documento abre em nova janela para imprimir ou salvar em PDF. Contém dados sensíveis: entregue somente a quem tem direito.</p>',
    aoSalvar: async d => {
      const lista = linhaDoTempo(atendimentos, { especialidade: d.especialidade, incluirAnulados: false }).filter(a => noPeriodo(a.data, d.de, d.ate)).reverse();
      imprimirProntuario({ estudante: e, privado, saude, atendimentos: lista, registros: reg, filtros: d });
    }
  });
}

function fichaEscola(e, atendimentos, agenda, saude, clinico) {
  modal({
    titulo: 'Ficha para a professora', botao: 'Gerar ficha',
    corpo: '<p>Resumo de uma página para a professora e a escola: quem acompanha o aluno, as orientações para a sala de aula e os próximos atendimentos. <strong>Não inclui o registro clínico.</strong></p>'
      + (clinico && saude?.necessidade_informada ? '<label class="check"><input type="checkbox" name="condicao"> Incluir a condição informada (' + esc(saude.necessidade_informada) + ') — somente com autorização da família</label>' : ''),
    aoSalvar: async d => imprimirFichaEscola({ estudante: e, atendimentos, agenda, condicao: d.condicao ? saude.necessidade_informada : '' })
  });
}

function novaCondicao(e) {
  modal({
    titulo: 'Problema / condição — ' + e.nome, botao: 'Adicionar',
    corpo: '<p class="nota">Lista de problemas e condições acompanhados pela equipe, como no PEC. Ex.: "Troca de fonemas /p/ e /b/", "Dificuldade de atenção em sala", "TEA — comunicação funcional".</p>'
      + campo('descricao', 'Problema ou condição', { obrig: true, largo: true, extra: 'maxlength="150"' })
      + area('observacao', 'Observação (opcional)', { max: 300, linhas: 2 }),
    aoSalvar: async d => { await dados.criarCondicao(e.id, validarCondicao(d), S.perfil); aviso('Adicionado à folha de rosto.'); eventos.aoMudar(); }
  });
}
