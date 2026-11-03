// Fila de espera: pedidos de atendimento feitos pela escola, por especialidade.
// A equipe agenda pela ordem (prioridade alta primeiro, depois quem espera há mais tempo).
import * as dados from '../dados.js';
import { S, pode, escolaCurta, estudante, escopoEscolas, escolaAtual } from '../estado.js';
import { formPedido, formAgendar, eventos } from '../formularios.js';
import { ESPECIALIDADES, PRIORIDADES, SITUACAO_PEDIDO, ordenarFila, resumoFila, diasDeEspera, formatarData, ms } from '../dominio.js';
import { esc, vazio, modal, area, aviso, erro, $, $$ } from '../ui.js';

export async function carregarPedidos(forcar = false) {
  if (S.pedidos && !forcar) return S.pedidos;
  S.pedidos = await dados.listarPedidos({ escolas: escopoEscolas() || undefined });
  return S.pedidos;
}
export const podePedir = () => pode.registrar() || pode.gestao() || S.perfil.perfil === 'direcao';

let filtro = { especialidade: '', mostrar: 'aguardando' };

export async function render(main, vigente) {
  const pedidos = await carregarPedidos(true);
  if (!vigente()) return;
  if (filtro.especialidade === '' && S.perfil.perfil === 'especialista' && !filtro._iniciado) filtro.especialidade = S.perfil.especialidade || '';
  filtro._iniciado = true;
  const daEscola = p => !escolaAtual() || p.escola_id === escolaAtual();
  const r = resumoFila(pedidos, Date.now(), daEscola);
  const lista = filtro.mostrar === 'aguardando'
    ? ordenarFila(pedidos.filter(p => daEscola(p) && (!filtro.especialidade || p.especialidade === filtro.especialidade)))
    : pedidos.filter(p => daEscola(p) && p.situacao !== 'aguardando' && (!filtro.especialidade || p.especialidade === filtro.especialidade)).sort((a, b) => ms(b.atualizado_em) - ms(a.atualizado_em)).slice(0, 100);
  const veMotivo = pode.clinico() || pode.gestao() || S.perfil.perfil === 'direcao';
  const minhaEsp = p => S.perfil.perfil === 'especialista' && p.especialidade === S.perfil.especialidade;
  const podeAgendar = p => minhaEsp(p) || pode.gestao() || S.perfil.perfil === 'direcao';

  const metrica = (rot, v, cor, dica = '') => '<div class="metrica m-' + cor + '"' + (dica ? ' title="' + esc(dica) + '"' : '') + '><span>' + rot + '</span><b>' + v + '</b></div>';
  let h = '<header class="pagina-topo"><div><h1>Fila de espera</h1><p>Pedidos de atendimento feitos pelas escolas. A equipe agenda por prioridade e ordem de chegada.</p></div>'
    + (podePedir() ? '<button class="btn" id="novo-pedido">+ Pedir atendimento</button>' : '') + '</header>'
    + '<div class="metricas">' + metrica('Aguardando', r.aguardando, 'azul') + metrica('Prioridade alta', r.altas, 'ambar')
    + metrica('Espera média', r.esperaMedia + ' dia(s)', 'roxo') + metrica('Tempo até agendar', r.agendados ? r.tempoAteAgendar + ' dia(s)' : '—', 'verde', 'Média dos pedidos já agendados') + '</div>'
    + '<section class="cartao"><div class="filtro-chips">'
    + [['', 'Todas'], ...Object.entries(ESPECIALIDADES)].map(([k, n]) => '<button type="button" class="chip-btn' + (filtro.especialidade === k ? ' ativo' : '') + (k ? ' esp-' + k : '') + '" data-esp="' + k + '">' + n
      + (k && r.porEspecialidade[k] ? ' <span class="contagem">' + r.porEspecialidade[k].aguardando + '</span>' : '') + '</button>').join('')
    + '<label class="check"><input type="checkbox" id="historico"' + (filtro.mostrar !== 'aguardando' ? ' checked' : '') + '> Ver já agendados / cancelados</label></div>';
  h += lista.length ? '<ol class="fila-espera">' + lista.map((p, i) => {
    const e = estudante(p.estudante_id), dias = diasDeEspera(p);
    return '<li class="pedido esp-' + esc(p.especialidade) + (p.prioridade === 'alta' ? ' alta' : '') + '">'
      + (filtro.mostrar === 'aguardando' ? '<span class="posicao">' + (i + 1) + 'º</span>' : '')
      + '<div class="pedido-info"><strong><a href="#/aluno/' + esc(p.estudante_id) + '">' + esc(e?.nome || 'Aluno') + '</a></strong>'
      + '<small>' + esc(escolaCurta(p.escola_id)) + (e?.turma ? ' · ' + esc(e.turma) : '') + ' · <span class="tag-esp esp-' + esc(p.especialidade) + '">' + esc(ESPECIALIDADES[p.especialidade]) + '</span>'
      + (p.prioridade === 'alta' ? ' <span class="selo s-falta">Prioridade alta</span>' : '') + '</small>'
      + (veMotivo ? '<p class="texto">' + esc(p.motivo) + '</p>' : '')
      + '<small class="nota">Pedido por ' + esc(p.solicitante_nome) + ' em ' + esc(formatarData(p.criado_em))
      + (p.situacao === 'aguardando' ? ' · <b>' + dias + ' dia(s) na fila</b>' : ' · ' + esc(SITUACAO_PEDIDO[p.situacao]) + ' em ' + esc(formatarData(p.atualizado_em)) + (p.motivo_cancelamento ? ': ' + esc(p.motivo_cancelamento) : '')) + '</small></div>'
      + (p.situacao === 'aguardando' ? '<div class="acoes-linha">'
        + (podeAgendar(p) ? '<button class="btn pequeno" data-agendar="' + esc(p.id) + '">Agendar</button>' : '')
        + (pode.registrar() || pode.gestao() ? '<button class="btn sec pequeno" data-prioridade="' + esc(p.id) + '">' + (p.prioridade === 'alta' ? 'Prioridade normal' : 'Prioridade alta') + '</button>' : '')
        + '<button class="link perigo" data-cancelar="' + esc(p.id) + '">Retirar da fila</button></div>' : '')
      + '</li>';
  }).join('') + '</ol>' : vazio(filtro.mostrar === 'aguardando' ? 'Ninguém aguardando' + (filtro.especialidade ? ' em ' + ESPECIALIDADES[filtro.especialidade] : '') + '.' : 'Sem histórico.', podePedir() ? 'Use "+ Pedir atendimento" quando a escola identificar um aluno que precisa de avaliação.' : '');
  h += '</section>';
  if (Object.keys(r.porEscola).length > 1 && !escolaAtual()) {
    h += '<section class="cartao"><h2>Demanda por instituição</h2><table class="tabela"><thead><tr><th>Instituição</th><th>Aguardando</th>' + Object.values(ESPECIALIDADES).map(n => '<th>' + n + '</th>').join('') + '</tr></thead><tbody>'
      + Object.entries(r.porEscola).sort((a, b) => b[1].aguardando - a[1].aguardando).map(([id, x]) => '<tr><td>' + esc(escolaCurta(id)) + '</td><td class="num">' + x.aguardando + '</td>' + Object.keys(ESPECIALIDADES).map(k => '<td class="num">' + (x.porEspecialidade[k] || 0) + '</td>').join('') + '</tr>').join('') + '</tbody></table></section>';
  }
  main.innerHTML = h;

  $('#novo-pedido', main)?.addEventListener('click', () => formPedido());
  $$('[data-esp]', main).forEach(b => b.onclick = () => { filtro.especialidade = b.dataset.esp; render(main, vigente); });
  $('#historico', main).onchange = ev => { filtro.mostrar = ev.target.checked ? 'historico' : 'aguardando'; render(main, vigente); };
  const achar = id => pedidos.find(p => p.id === id);
  $$('[data-agendar]', main).forEach(b => b.onclick = () => {
    const p = achar(b.dataset.agendar);
    formAgendar({ estudanteId: p.estudante_id, especialidade: p.especialidade, aoAgendar: async (agId, ag) => {
      if (ag.especialidade !== p.especialidade) return aviso('Agendado com outra especialidade: o pedido continua na fila.', 'aviso');
      try { await dados.pedidoAgendado(p.id, agId); S.pedidos = null; } catch (e) { erro(e); }
    } });
  });
  $$('[data-prioridade]', main).forEach(b => b.onclick = async () => {
    const p = achar(b.dataset.prioridade);
    try { await dados.priorizarPedido(p.id, p.prioridade === 'alta' ? 'normal' : 'alta'); render(main, vigente); } catch (e) { erro(e); }
  });
  $$('[data-cancelar]', main).forEach(b => b.onclick = () => {
    const p = achar(b.dataset.cancelar);
    modal({ titulo: 'Retirar da fila', botao: 'Retirar', corpo: '<p>' + esc(estudante(p.estudante_id)?.nome || 'Aluno') + ' — ' + esc(ESPECIALIDADES[p.especialidade]) + '</p>' + area('motivo', 'Motivo', { obrig: true, max: 500, linhas: 2, dica: 'Ex.: atendido sem agendamento; transferido; família recusou' }),
      aoSalvar: async d => { await dados.cancelarPedido(p.id, d.motivo.trim()); S.pedidos = null; aviso('Pedido retirado da fila.'); eventos.aoMudar(); } });
  });
}
