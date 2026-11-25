// Módulo de relatórios: somente atendimentos realizados (sem conteúdo clínico).
import * as dados from '../dados.js';
import { S, pode, escolaCurta, especialistasDaEscola, escolasVisiveis, escopoEscolas, escolaAtual, estudante, seloEscola, garantirAtendimentos } from '../estado.js';
import { ESPECIALIDADES, TIPOS_ATENDIMENTO, EVOLUCAO, diaMunicipal, somarDias, instante, resumoGerencial, csv, formatarDataHora, ms, ultimosMeses, serieMensal, rotuloMes, resumoFila,
  diasDeEspera, periodoAnterior, variacao, evolucaoPorEspecialidade, regressoesSeguidas, presencaPorEscola, ocupacaoAgenda, situacaoDosAlunos } from '../dominio.js';
import { colunasEmpilhadas, ligarGrafico, minilinha, barra100, mapaCalor } from '../grafico.js';
import { carregarPedidos } from './fila.js';
import { esc, vazio, aviso, $, $$ } from '../ui.js';
import { imprimirGerencial, imprimirProntuario, imprimirMeusAtendimentos, definirRegistro } from '../impressao.js';

const LIMITE_TABELA = 300;

export async function render(main, vigente) {
  const hoje = diaMunicipal(Date.now());
  const f = S.filtrosRelatorio ||= { de: hoje.slice(0, 7) + '-01', ate: hoje, escola: escolaAtual(), especialidade: '', profissional: S.perfil.perfil === 'especialista' ? S.user.uid : '' };
  if (f.de && f.ate && f.de > f.ate) [f.de, f.ate] = [f.ate, f.de];
  const painel = pode.gestao() || ['direcao', 'secretaria_escolar', 'pedagogico'].includes(S.perfil.perfil);
  const meses = ultimosMeses(12, hoje);
  const periodo = { de: f.de ? instante(f.de, '00:00') : undefined, ate: f.ate ? instante(somarDias(f.ate, 1), '00:00') : undefined };
  // Painel ampliado: agenda do período (presença e ocupação) e situação dos alunos. Falhas nessas leituras só escondem a seção.
  const [atendimentos, ano, pedidos, agenda] = await Promise.all([
    dados.listarAtendimentos({ ...periodo, escolas: escopoEscolas() || undefined }),
    painel ? dados.listarAtendimentos({ de: instante(meses[0] + '-01', '00:00'), escolas: escopoEscolas() || undefined }) : [],
    painel ? carregarPedidos().catch(() => []) : [],
    painel && f.de && f.ate ? dados.listarAgendamentos({ de: periodo.de, ate: periodo.ate, escolas: escopoEscolas() || undefined }).catch(e => (console.warn('agenda do relatório', e), null)) : null,
    painel ? garantirAtendimentos().catch(e => (console.warn('acompanhamento', e), null)) : null
  ]);
  if (!vigente()) return;
  const filtro = a => (!f.escola || a.escola_id === f.escola) && (!f.especialidade || a.especialidade === f.especialidade) && (!f.profissional || a.profissional_uid === f.profissional);
  const r = resumoGerencial({ atendimentos, filtros: f });
  const lista = atendimentos.filter(a => a.situacao !== 'anulado' && filtro(a)).sort((a, b) => ms(b.data) - ms(a.data));
  const profs = especialistasDaEscola(f.escola);
  const sel = (nome, rotulo, itens, vazioTxt) => '<label class="campo"><span>' + rotulo + '</span><select name="' + nome + '"><option value="">' + vazioTxt + '</option>' + itens.map(([v, t]) => '<option value="' + esc(v) + '"' + (f[nome] === v ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select></label>';
  const horas = m => String(Math.round(m / 6) / 10).replace('.', ',');
  const filtros = '<form class="cartao filtros" id="filtros">'
    + '<label class="campo"><span>De</span><input type="date" name="de" value="' + esc(f.de) + '"></label><label class="campo"><span>Até</span><input type="date" name="ate" value="' + esc(f.ate) + '"></label>'
    + sel('escola', 'Instituição', escolasVisiveis().map(e => [e.id, escolaCurta(e.id)]), 'Todas')
    + sel('especialidade', 'Especialidade', Object.entries(ESPECIALIDADES), 'Todas')
    + sel('profissional', 'Profissional', profs.map(u => [u.id, u.nome]), 'Toda a equipe') + '</form>';
  const tabelas = '<div class="colunas">'
    + '<section class="cartao"><h2>Por instituição</h2>' + (Object.keys(r.porEscola).length ? '<table class="tabela"><thead><tr><th>Instituição</th><th>Alunos</th><th>Atend.</th>' + Object.keys(ESPECIALIDADES).map(k => '<th title="' + ESPECIALIDADES[k] + '">' + ESPECIALIDADES[k].slice(0, 5) + '.</th>').join('') + '</tr></thead><tbody>'
      + Object.entries(r.porEscola).sort((a, b) => b[1].atendimentos - a[1].atendimentos).map(([id, e]) => '<tr><td>' + esc(escolaCurta(id)) + '</td><td class="num">' + e.alunos + '</td><td class="num">' + e.atendimentos + '</td>' + Object.keys(ESPECIALIDADES).map(k => '<td class="num">' + (e.porEspecialidade[k] || 0) + '</td>').join('') + '</tr>').join('') + '</tbody></table>' : vazio('Sem atendimentos no período.')) + '</section>'
    + '<section class="cartao"><h2>Por profissional</h2>' + (Object.keys(r.porProfissional).length ? '<table class="tabela"><thead><tr><th>Profissional</th><th>Especialidade</th><th>Atend.</th><th>Alunos</th><th>Horas</th></tr></thead><tbody>'
      + Object.values(r.porProfissional).map(p => '<tr><td>' + esc(p.nome) + '</td><td>' + esc(ESPECIALIDADES[p.especialidade]) + '</td><td class="num">' + p.atendimentos + '</td><td class="num">' + p.alunos + '</td><td class="num">' + horas(p.minutos) + '</td></tr>').join('') + '</tbody></table>' : vazio('Sem atendimentos no período.'))
    + '<h2 class="subtitulo">Por tipo</h2>' + barras(r.porTipo, TIPOS_ATENDIMENTO) + '</section></div>';
  const listaHtml = '<section class="cartao"><h2>Atendimentos realizados (' + lista.length + ')</h2>'
    + (lista.length ? '<table class="tabela"><thead><tr><th>Data</th><th>Código</th><th>Aluno</th><th>Instituição</th><th>Profissional</th><th>Tipo</th><th>Evolução</th><th>Min</th></tr></thead><tbody>'
      + lista.slice(0, LIMITE_TABELA).map(a => '<tr><td>' + esc(formatarDataHora(a.data)) + '</td><td>' + esc(a.codigo || '—') + '</td><td><a href="#/aluno/' + esc(a.estudante_id) + '">' + esc(estudante(a.estudante_id)?.nome || 'Aluno') + '</a></td><td>' + esc(escolaCurta(a.escola_id)) + '</td><td>' + esc(a.profissional_nome) + '<br><small class="nota">' + esc(ESPECIALIDADES[a.especialidade]) + '</small></td><td>' + esc(TIPOS_ATENDIMENTO[a.tipo]) + '</td><td>' + esc(EVOLUCAO[a.evolucao]) + '</td><td class="num">' + a.duracao_min + '</td></tr>').join('')
      + '</tbody></table>' + (lista.length > LIMITE_TABELA ? '<p class="nota">Mostrando os ' + LIMITE_TABELA + ' mais recentes. A planilha traz todos.</p>' : '')
      : vazio('Nenhum atendimento realizado no período.')) + '</section>';
  const topo = '<header class="pagina-topo"><div><h1>Relatórios de atendimentos</h1><p>' + (painel ? 'Indicadores da rede no período escolhido' + (f.de && f.ate ? ' (' + dataBR(f.de) + ' a ' + dataBR(f.ate) + ')' : '') + '. Textos clínicos nunca aparecem aqui.' : 'Somente atendimentos realizados. Faltas, cancelamentos e textos clínicos não entram neste módulo.') + '</p></div>'
    + '<div class="acoes-linha"><button class="btn sec" id="csv">Exportar planilha (CSV)</button><button class="btn" id="imprimir">Imprimir / PDF</button></div></header>';

  let faltas = null;
  if (!painel) {
    const card = (rot, v, cor) => '<div class="metrica m-' + cor + '"><span>' + rot + '</span><b>' + v + '</b></div>';
    // Faltas e cancelamentos da própria especialista no período (agenda).
    const minhaAgenda = S.perfil.perfil === 'especialista' && f.de && f.ate ? await dados.listarAgendamentos({ profissional: S.user.uid, de: periodo.de, ate: periodo.ate }).catch(() => []) : [];
    if (!vigente()) return;
    faltas = minhaAgenda.filter(a => a.status === 'falta' && filtro(a));
    const canc = minhaAgenda.filter(a => a.status === 'cancelado' && filtro(a)).length;
    const abaE = S.abaRelEsp || 'meus';
    // Alunos atendidos no período (para o relatório por aluno).
    const alunosPeriodo = [...new Set(lista.map(a => a.estudante_id))].map(id => estudante(id)).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    if (S.relAluno && !alunosPeriodo.some(e => e.id === S.relAluno)) S.relAluno = '';
    const doAluno = S.relAluno ? lista.filter(a => a.estudante_id === S.relAluno).slice().reverse() : [];
    const evoAluno = doAluno.reduce((m, a) => (m[a.evolucao] = (m[a.evolucao] || 0) + 1, m), {});
    const porAluno = '<section class="cartao"><h2>Relatório por aluno</h2><p class="nota">Tudo o que foi registrado do aluno no período escolhido acima (De/Até), pronto para imprimir ou salvar em PDF: identificação, cada consulta (S, O, A, P), evolução e orientações para a escola.</p>'
      + '<label class="campo"><span>Aluno atendido no período</span><select id="rel-aluno"><option value="">Selecione o aluno</option>' + alunosPeriodo.map(e => '<option value="' + esc(e.id) + '"' + (e.id === S.relAluno ? ' selected' : '') + '>' + esc(e.nome) + ' — ' + esc(escolaCurta(e.escola_id)) + '</option>').join('') + '</select></label>'
      + (S.relAluno ? '<div class="metricas">' + card('Consultas no período', doAluno.length, 'azul') + card('Avançou', evoAluno.avancou || 0, 'verde') + card('Estável', evoAluno.estavel || 0, 'ambar') + card('Regrediu', evoAluno.regrediu || 0, 'roxo') + '</div>'
        + '<table class="tabela"><thead><tr><th>Data</th><th>Tipo</th><th>Evolução</th><th>Min</th></tr></thead><tbody>' + doAluno.map(a => '<tr><td>' + esc(formatarDataHora(a.data)) + '</td><td>' + esc(TIPOS_ATENDIMENTO[a.tipo]) + '</td><td>' + esc(EVOLUCAO[a.evolucao]) + '</td><td class="num">' + a.duracao_min + '</td></tr>').join('') + '</tbody></table>'
        + '<div class="acoes-linha"><button class="btn" id="imprimir-aluno">Imprimir relatório do aluno (PDF)</button><a class="btn sec" href="#/aluno/' + esc(S.relAluno) + '">Abrir prontuário</a></div>'
        : (alunosPeriodo.length ? '' : vazio('Nenhum aluno atendido no período.', 'Ajuste as datas De/Até.'))) + '</section>';
    const meus = '<div class="metricas">' + card('Atendimentos realizados', r.atendimentos, 'azul') + card('Alunos atendidos', r.alunos, 'verde') + card('Horas de atendimento', horas(r.horas * 60), 'roxo') + card('Faltas de alunos', faltas.length, 'ambar') + '</div>'
      + (canc ? '<p class="nota">' + canc + ' agendamento(s) cancelado(s) no período.</p>' : '')
      + '<div class="acoes-linha"><button class="btn" id="imprimir-meus">Imprimir meus atendimentos (lista com alunos)</button></div>'
      + '<section class="cartao"><h2>Evolução observada</h2><p class="nota">Registro de evolução nos seus atendimentos do período.</p>' + evolucaoHtml(lista) + '</section>'
      + tabelas + listaHtml;
    const abasE = [['meus', 'Meus atendimentos'], ['aluno', 'Por aluno']];
    main.innerHTML = topo + filtros
      + '<nav class="abas-rel" role="tablist" aria-label="Relatórios">' + abasE.map(([k, t]) => '<button type="button" role="tab" class="aba-rel' + (k === abaE ? ' ativa' : '') + '" aria-selected="' + (k === abaE) + '" data-aba-esp="' + k + '">' + t + '</button>').join('') + '</nav>'
      + secao('meus', abaE, meus) + secao('aluno', abaE, porAluno);
    $$('[data-aba-esp]', main).forEach(b => b.onclick = () => { S.abaRelEsp = b.dataset.abaEsp; render(main, vigente); });
    $('#rel-aluno', main)?.addEventListener('change', ev => { S.relAluno = ev.target.value; S.abaRelEsp = 'aluno'; render(main, vigente); });
    $('#imprimir-meus', main)?.addEventListener('click', () => imprimirMeusAtendimentos({ lista, faltas, filtros: f, resumo: r }));
    $('#imprimir-aluno', main)?.addEventListener('click', async () => {
      const e = estudante(S.relAluno);
      try {
        const regs = new Map((await dados.listarRegistros(e.id)).map(x => [x.id, x]));
        definirRegistro(dados.registrarImpressao(S.perfil, e, 'impressao'));
        imprimirProntuario({ estudante: e, privado: null, saude: null, atendimentos: doAluno, registros: regs, filtros: { de: f.de, ate: f.ate, especialidade: S.perfil.especialidade || '' } });
      } catch (err) { aviso('Não foi possível gerar o relatório: ' + err.message, 'erro'); }
    });
  } else {
    const aba = S.abaRelatorio || 'geral';
    const abas = [['geral', 'Visão geral'], ['escolas', 'Por escola e profissional'], ['evolucao', 'Evolução dos alunos'], ['agenda', 'Agenda e presença'], ['lista', 'Lista de atendimentos']];
    main.innerHTML = topo + filtros
      + '<nav class="abas-rel" role="tablist" aria-label="Seções do relatório">' + abas.map(([k, t]) => '<button type="button" role="tab" class="aba-rel' + (k === aba ? ' ativa' : '') + '" aria-selected="' + (k === aba) + '" data-aba="' + k + '">' + t + '</button>').join('') + '</nav>'
      + secao('geral', aba, indicadores({ r, ano, meses, f, pedidos }) + caminhoDoAluno({ pedidos, f }) + painelSecretaria({ ano, meses, pedidos, f }))
      + secao('escolas', aba, redeEmUmOlhar({ r, ano, pedidos, f }) + tabelas)
      + secao('evolucao', aba, '<section class="cartao"><h2>Evolução observada</h2><p class="nota">Registro de evolução em cada atendimento do período, por especialidade.</p>' + evolucaoHtml(lista) + '</section>'
        + regressoesHtml(f))
      + secao('agenda', aba, agendaHtml({ agenda, f }))
      + secao('lista', aba, listaHtml);
    $$('[data-aba]', main).forEach(b => b.onclick = () => {
      S.abaRelatorio = b.dataset.aba;
      $$('[data-aba]', main).forEach(x => { x.classList.toggle('ativa', x === b); x.setAttribute('aria-selected', String(x === b)); });
      $$('[data-secao]', main).forEach(s => { s.hidden = s.dataset.secao !== b.dataset.aba; });
    });
  }

  if (painel) ligarGrafico(main, dadosGrafico(ano, meses, f));
  $('#filtros', main).onchange = ev => { S.filtrosRelatorio = { ...f, ...Object.fromEntries(new FormData(ev.currentTarget)) }; render(main, vigente); };
  $('#imprimir', main).onclick = () => imprimirGerencial(r, f, { profissional: profs.find(u => u.id === f.profissional)?.nome });
  $('#csv', main).onclick = () => {
    const linhas = [['Data', 'Código da consulta', 'Código do aluno', 'Instituição', 'Especialidade', 'Profissional', 'Tipo', 'Evolução', 'Duração (min)']]
      .concat(lista.map(a => [formatarDataHora(a.data), a.codigo || '', a.estudante_id.slice(-6), escolaCurta(a.escola_id), ESPECIALIDADES[a.especialidade], a.profissional_nome, TIPOS_ATENDIMENTO[a.tipo], EVOLUCAO[a.evolucao], a.duracao_min]));
    const url = URL.createObjectURL(new Blob([csv(linhas)], { type: 'text/csv;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'atendimentos_' + (f.de || 'inicio') + '_' + (f.ate || hoje) + '.csv' });
    document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    aviso('Planilha gerada sem nomes de alunos (LGPD): use o código para localizar.');
  };
}

const secao = (k, aba, html) => '<div class="secao-rel" data-secao="' + k + '"' + (k === aba ? '' : ' hidden') + '>' + html + '</div>';
const dataBR = d => d ? d.split('-').reverse().join('/') : '';
const pct = (v, t) => t ? Math.round(v / t * 100) : 0;
const COR_ESP = { fonoaudiologia: 'var(--fono)', neuropsicologia: 'var(--neuro)', psicopedagogia: 'var(--psico)' };

/** Cartões do topo: valor do período, variação sobre o período anterior e tendência de 12 meses. */
function indicadores({ r, ano, meses, f }) {
  const filtro = a => (!f.escola || a.escola_id === f.escola) && (!f.especialidade || a.especialidade === f.especialidade) && (!f.profissional || a.profissional_uid === f.profissional);
  const doAno = ano.filter(a => a.situacao !== 'anulado' && filtro(a));
  const ant = periodoAnterior(f.de, f.ate), cobre = ant && ant.de >= meses[0] + '-01';
  const rAnt = cobre ? resumoGerencial({ atendimentos: ano, filtros: { ...f, de: ant.de, ate: ant.ate } }) : null;
  const serie = serieMensal(doAno, meses);
  const alunosMes = meses.map(m => new Set(doAno.filter(a => diaMunicipal(a.data).startsWith(m)).map(a => a.estudante_id)).size);
  const minutosMes = meses.map(m => doAno.filter(a => diaMunicipal(a.data).startsWith(m)).reduce((s, a) => s + (Number(a.duracao_min) || 0), 0) / 60);
  const delta = (atual, anterior, unidade = '%') => {
    if (!rAnt) return '<small class="delta">Sem comparação para este período</small>';
    const v = unidade === '%' ? variacao(atual, anterior) : atual - anterior;
    if (v === null) return '<small class="delta">Sem dados no período anterior</small>';
    const s = v > 0 ? '+' + v : v < 0 ? '−' + Math.abs(v) : '0';
    return '<small class="delta"><b>' + s + (unidade === '%' ? '%' : '') + '</b> sobre o período anterior</small>';
  };
  const k = (rot, valor, d, serieV, cor) => '<div class="metrica kpi" style="border-top-color:' + cor + '"><span>' + rot + '</span><div class="kpi-linha"><b>' + valor + '</b>' + minilinha(serieV, cor) + '</div>' + d + '</div>';
  return '<div class="metricas">'
    + k('Atendimentos realizados', r.atendimentos, delta(r.atendimentos, rAnt?.atendimentos), serie.map(m => m.total), 'var(--fono)')
    + k('Alunos atendidos', r.alunos, delta(r.alunos, rAnt?.alunos, 'n'), alunosMes, 'var(--acento)')
    + k('Horas de atendimento', String(r.horas).replace('.', ','), delta(r.horas, rAnt?.horas), minutosMes, 'var(--neuro)')
    + k('Altas', r.altas, delta(r.altas, rAnt?.altas, 'n'), meses.map(m => doAno.filter(a => a.tipo === 'alta' && diaMunicipal(a.data).startsWith(m)).length), 'var(--psico)')
    + '</div>';
}

/** Situação atual: fila → aguardando 1º atendimento → em acompanhamento → alta. */
function caminhoDoAluno({ pedidos, f }) {
  if (!S.acompanhamento) return '';
  const alunos = S.estudantes.filter(e => (!f.escola || e.escola_id === f.escola) && (!escopoEscolas() || escopoEscolas().includes(e.escola_id)));
  const acomp = f.especialidade ? new Map([...S.acompanhamento].map(([id, s]) => [id, { estado: s.porEspecialidade[f.especialidade] ? (s.altas.includes(f.especialidade) ? 'alta' : 'em_acompanhamento') : 'aguardando' }])) : S.acompanhamento;
  const sit = situacaoDosAlunos(alunos, acomp);
  const fila = resumoFila(pedidos, Date.now(), p => (!f.escola || p.escola_id === f.escola) && (!f.especialidade || p.especialidade === f.especialidade));
  const etapas = [['Na fila de espera', fila.aguardando, 'pedidos das escolas ainda sem agendamento'], ['Aguardando 1º atendimento', sit.aguardando, 'alunos ativos sem nenhum atendimento' + (f.especialidade ? ' nesta especialidade' : '')],
    ['Em acompanhamento', sit.em_acompanhamento, 'alunos com atendimento e sem alta'], ['Alta', sit.alta, 'alunos que concluíram o acompanhamento']];
  const max = Math.max(1, ...etapas.map(e => e[1]));
  return '<section class="cartao"><h2>Caminho dos alunos</h2><p class="nota">Situação atual dos alunos ativos' + (f.escola ? ' de ' + esc(escolaCurta(f.escola)) : ' da rede') + '.</p>'
    + '<div class="caminho">' + etapas.map(([t, n, s], i) => '<div class="caminho-linha"><div><strong>' + t + '</strong><small>' + s + '</small></div><div class="caminho-trilho"><i style="width:' + (n / max * 100) + '%;opacity:' + (1 - i * .16) + '"></i></div><b class="num">' + n + '</b></div>').join('') + '</div>'
    + '<div class="caminho-tempos"><div><b>' + (fila.aguardando ? fila.esperaMedia + ' dias' : '—') + '</b>espera média na fila</div><div><b>' + (fila.aguardando ? fila.esperaMaxima + ' dias' : '—') + '</b>maior espera atual</div><div><b>' + (fila.agendados ? fila.tempoAteAgendar + ' dias' : '—') + '</b>do pedido ao agendamento</div></div></section>';
}

/** Cartões por instituição: alunos, atendimentos e fila, com a divisão por especialidade. */
function redeEmUmOlhar({ r, pedidos, f }) {
  const fila = resumoFila(pedidos, Date.now(), p => !f.especialidade || p.especialidade === f.especialidade);
  const escolas = escolasVisiveis().filter(e => !f.escola || e.id === f.escola);
  if (!escolas.length) return '';
  return '<section class="cartao"><h2>Rede em um olhar</h2><p class="nota">Atendimentos do período em cada instituição e alunos aguardando na fila.</p><div class="rede-grade">'
    + escolas.map(e => {
      const x = r.porEscola[e.id] || { alunos: 0, atendimentos: 0, porEspecialidade: {} }, espera = fila.porEscola[e.id]?.aguardando || 0;
      const antigos = pedidos.filter(p => p.situacao === 'aguardando' && p.escola_id === e.id && (!f.especialidade || p.especialidade === f.especialidade) && diasDeEspera(p) > 15).length;
      return '<article class="escola-cartao">' + '<header>' + seloEscola(e.id, 'mini') + '<div><strong>' + esc(escolaCurta(e.id)) + '</strong><small>' + (e.tipo === 'creche' ? 'Creche' : 'Escola') + '</small></div></header>'
        + '<div class="escola-numeros"><div><b class="num">' + x.alunos + '</b>alunos</div><div><b class="num">' + x.atendimentos + '</b>atendimentos</div><div><b class="num">' + espera + '</b>na fila</div></div>'
        + barra100(Object.keys(ESPECIALIDADES).map(k => ({ valor: x.porEspecialidade[k] || 0, classe: 'cat-' + k, rotulo: ESPECIALIDADES[k] })), { altura: 10 })
        + '<div class="legenda pequena">' + Object.keys(ESPECIALIDADES).map(k => '<span><i class="cat-' + k + '"></i>' + ESPECIALIDADES[k].slice(0, 5) + '. ' + (x.porEspecialidade[k] || 0) + '</span>').join('') + '</div>'
        + (antigos ? '<span class="alerta-mini">⚠ ' + antigos + ' aluno(s) aguardando há mais de 15 dias</span>' : '') + '</article>';
    }).join('') + '</div></section>';
}

const ORDEM_EVOL = [['avancou', 'ev-avancou'], ['estavel', 'ev-estavel'], ['regrediu', 'ev-regrediu'], ['nao_avaliado', 'ev-nao']];
function evolucaoHtml(lista) {
  const ev = evolucaoPorEspecialidade(lista), linhas = Object.keys(ESPECIALIDADES).filter(k => ev[k]);
  if (!linhas.length) return vazio('Sem atendimentos no período.');
  return '<div class="legenda">' + ORDEM_EVOL.map(([k, c]) => '<span><i class="' + c + '"></i>' + EVOLUCAO[k] + '</span>').join('') + '</div>'
    + linhas.map(k => '<div class="linha-barra"><span>' + esc(ESPECIALIDADES[k]) + '</span>' + barra100(ORDEM_EVOL.map(([e, c]) => ({ valor: ev[k][e], classe: c, rotulo: EVOLUCAO[e] }))) + '<b class="num" title="Atendimentos em que o aluno avançou">' + pct(ev[k].avancou, ev[k].total) + '%</b></div>').join('')
    + '<p class="nota">À direita: percentual de atendimentos em que o aluno avançou. Passe o mouse nas barras para ver as quantidades.</p>'
    + '<details class="tabela-grafico"><summary>Ver como tabela</summary><table class="tabela"><thead><tr><th>Especialidade</th>' + ORDEM_EVOL.map(([e]) => '<th>' + EVOLUCAO[e] + '</th>').join('') + '<th>Total</th></tr></thead><tbody>'
    + linhas.map(k => '<tr><td>' + esc(ESPECIALIDADES[k]) + '</td>' + ORDEM_EVOL.map(([e]) => '<td class="num">' + ev[k][e] + '</td>').join('') + '<td class="num"><b>' + ev[k].total + '</b></td></tr>').join('') + '</tbody></table></details>';
}
function regressoesHtml(f) {
  if (!S.atendimentos) return '';
  const lista = regressoesSeguidas(S.atendimentos).filter(x => (!f.escola || x.escola_id === f.escola) && (!f.especialidade || x.especialidade === f.especialidade));
  return '<section class="cartao"><h2>Atenção: regressão em dois atendimentos seguidos (' + lista.length + ')</h2><p class="nota">Alunos cujos dois últimos atendimentos na mesma especialidade registraram “Regrediu”. Vale conversar com a especialista responsável.</p>'
    + (lista.length ? '<table class="tabela"><thead><tr><th>Aluno</th><th>Instituição</th><th>Especialidade</th><th>Último atendimento</th></tr></thead><tbody>'
      + lista.slice(0, 50).map(x => '<tr><td><a href="#/aluno/' + esc(x.estudante_id) + '">' + esc(estudante(x.estudante_id)?.nome || 'Aluno') + '</a></td><td>' + esc(escolaCurta(x.escola_id)) + '</td><td>' + esc(ESPECIALIDADES[x.especialidade] || '') + '</td><td>' + esc(formatarDataHora(x.data).slice(0, 10)) + '</td></tr>').join('') + '</tbody></table>'
      : '<p class="nota">Nenhum aluno nessa situação.</p>') + '</section>';
}
function agendaHtml({ agenda, f }) {
  if (!f.de || !f.ate) return '<section class="cartao">' + vazio('Escolha as datas De e Até para ver a agenda do período.') + '</section>';
  if (!agenda) return '<section class="cartao">' + vazio('Não foi possível carregar a agenda do período.') + '</section>';
  const ag = agenda.filter(a => (!f.escola || a.escola_id === f.escola) && (!f.especialidade || a.especialidade === f.especialidade) && (!f.profissional || a.profissional_uid === f.profissional));
  const pres = presencaPorEscola(ag), escolas = escolasVisiveis().filter(e => pres[e.id]);
  const partes = x => [{ valor: x.realizado, classe: 'pr-realizado', rotulo: 'Realizadas' }, { valor: x.falta, classe: 'pr-falta', rotulo: 'Faltas do aluno' }, { valor: x.cancelado, classe: 'pr-cancelado', rotulo: 'Canceladas' }];
  const presenca = '<section class="cartao"><h2>Presença nas consultas agendadas</h2><p class="nota">Consultas já ocorridas no período: realizadas, faltas do aluno e cancelamentos.</p>'
    + (escolas.length ? '<div class="legenda"><span><i class="pr-realizado"></i>Realizada</span><span><i class="pr-falta"></i>Falta do aluno</span><span><i class="pr-cancelado"></i>Cancelada</span></div>'
      + escolas.map(e => '<div class="linha-barra largo"><span>' + esc(escolaCurta(e.id)) + '</span>' + barra100(partes(pres[e.id])) + '<b class="num" title="Consultas realizadas">' + pct(pres[e.id].realizado, pres[e.id].total) + '%</b></div>').join('')
      + '<p class="nota">À direita: percentual de consultas realizadas.</p>'
      + '<details class="tabela-grafico"><summary>Ver como tabela</summary><table class="tabela"><thead><tr><th>Instituição</th><th>Realizadas</th><th>Faltas</th><th>Canceladas</th><th>Total</th></tr></thead><tbody>'
      + escolas.map(e => { const x = pres[e.id]; return '<tr><td>' + esc(escolaCurta(e.id)) + '</td><td class="num">' + x.realizado + '</td><td class="num">' + x.falta + '</td><td class="num">' + x.cancelado + '</td><td class="num"><b>' + x.total + '</b></td></tr>'; }).join('') + '</tbody></table></details>'
      : vazio('Nenhuma consulta ocorrida no período.')) + '</section>';
  const equipe = especialistasDaEscola(f.escola).filter(u => (!f.especialidade || u.especialidade === f.especialidade) && (!f.profissional || u.id === f.profissional));
  const oc = ocupacaoAgenda({ profissionais: equipe, agendamentos: ag, de: f.de, ate: f.ate });
  const ocupacao = '<section class="cartao"><h2>Ocupação da agenda</h2><p class="nota">Horários de jornada ocupados com consultas, até hoje' + (f.profissional ? '' : ' (' + equipe.length + ' profissional(is))') + '. Feriados e recessos não são descontados: o valor é aproximado.</p>'
    + (oc.length ? mapaCalor(oc) : vazio('Nenhuma jornada cadastrada para a seleção.')) + '</section>';
  return presenca + ocupacao;
}

function barras(contagem, rotulos) {
  const max = Math.max(1, ...Object.values(contagem));
  const itens = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
  return itens.length ? '<div class="barras">' + itens.map(([k, v]) => '<div class="barra"><span>' + esc(rotulos[k] || k) + '</span><i style="width:' + (v / max * 100) + '%"></i><b>' + v + '</b></div>').join('') + '</div>' : vazio('Sem dados.');
}

const CATEGORIAS = Object.entries(ESPECIALIDADES);
function dadosGrafico(ano, meses, f) {
  const filtrados = ano.filter(a => (!f.escola || a.escola_id === f.escola) && (!f.profissional || a.profissional_uid === f.profissional));
  return { colunas: serieMensal(filtrados, meses).map(m => ({ rotulo: rotuloMes(m.mes), valores: m.porEspecialidade })), categorias: CATEGORIAS.filter(([k]) => !f.especialidade || k === f.especialidade) };
}
/** Painel da Secretaria: atendimentos dos últimos 12 meses e demanda reprimida (fila de espera). */
function painelSecretaria({ ano, meses, pedidos, f }) {
  const g = dadosGrafico(ano, meses, f);
  const fila = resumoFila(pedidos, Date.now(), p => (!f.escola || p.escola_id === f.escola) && (!f.especialidade || p.especialidade === f.especialidade));
  const porEscola = Object.entries(fila.porEscola).sort((a, b) => b[1].aguardando - a[1].aguardando);
  return '<section class="cartao painel-secretaria"><header class="cartao-topo"><h2>Atendimentos por mês — últimos 12 meses' + (f.escola ? ' · ' + esc(escolaCurta(f.escola)) : '') + '</h2></header>'
    + colunasEmpilhadas({ ...g, titulo: 'Atendimentos realizados por mês e especialidade' }) + '</section>'
    + '<section class="cartao"><header class="cartao-topo"><h2>Demanda reprimida (fila de espera)</h2><a class="link" href="#/fila">Abrir fila →</a></header>'
    + '<div class="metricas">' + '<div class="metrica m-azul"><span>Aguardando</span><b>' + fila.aguardando + '</b></div><div class="metrica m-ambar"><span>Espera média</span><b>' + fila.esperaMedia + ' d</b></div>'
    + '<div class="metrica m-roxo"><span>Maior espera</span><b>' + fila.esperaMaxima + ' d</b></div><div class="metrica m-verde"><span>Tempo até agendar</span><b>' + (fila.agendados ? fila.tempoAteAgendar + ' d' : '—') + '</b></div></div>'
    + (porEscola.length ? '<table class="tabela"><thead><tr><th>Instituição</th><th>Aguardando</th>' + CATEGORIAS.map(([, n]) => '<th>' + n + '</th>').join('') + '</tr></thead><tbody>'
      + porEscola.map(([id, x]) => '<tr><td>' + esc(escolaCurta(id)) + '</td><td class="num"><b>' + x.aguardando + '</b></td>' + CATEGORIAS.map(([k]) => '<td class="num">' + (x.porEspecialidade[k] || 0) + '</td>').join('') + '</tr>').join('') + '</tbody></table>'
      : '<p class="nota">Nenhum aluno aguardando. A demanda aparece aqui quando as escolas usam "Pedir atendimento".</p>')
    + '</section>';
}
