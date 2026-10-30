import * as dados from '../dados.js';
import { S, pode, escolaCurta, especialistasDaEscola, escopoEscolas, escolaAtual } from '../estado.js';
import { formAgendar } from '../formularios.js';
import { ESPECIALIDADES, DIAS, diaMunicipal, inicioDaSemana, somarDias, instante, formatarData, ms, bloqueioDoDia, diasDoBloqueio, idBloqueio, numeroDoDia } from '../dominio.js';
import { esc, $, $$, modal, campo, opcoes, aviso, erro, vazio } from '../ui.js';
import * as dadosCal from '../dados.js';
import { linhaAgenda, ligarAgendamentos } from './painel.js';

let mostrarCancelados = false;

export async function render(main, vigente) {
  const hoje = diaMunicipal(Date.now());
  if (!S.agendaSemana) S.agendaSemana = inicioDaSemana(hoje);
  if (S.agendaProf === '' && S.perfil.perfil === 'especialista') S.agendaProf = S.user.uid;
  const ini = S.agendaSemana, fim = somarDias(ini, 7);
  const prof = S.agendaProf && S.agendaProf !== 'todas' ? S.usuarios.find(u => u.id === S.agendaProf) : null;
  const filtro = prof ? { profissional: prof.id } : { escolas: escolaAtual() ? [escolaAtual()] : escopoEscolas() || undefined };
  const lista = await dados.listarAgendamentos({ ...filtro, de: instante(ini, '00:00'), ate: instante(fim, '00:00') });
  if (!vigente()) return;
  const visiveis = lista.filter(a => (mostrarCancelados || a.status !== 'cancelado') && (!escolaAtual() || a.escola_id === escolaAtual())).sort((a, b) => ms(a.inicio) - ms(b.inicio));
  const temSabado = visiveis.some(a => diaMunicipal(a.inicio) === somarDias(ini, 6)) || (prof?.jornada || []).some(f => f.dia === 6);
  const dias = [1, 2, 3, 4, 5, ...(temSabado ? [6] : [])].map(n => somarDias(ini, n));

  main.innerHTML = '<header class="pagina-topo"><div><h1>Agenda</h1><p>Semana de ' + formatarData(instante(dias[0], '12:00')) + ' a ' + formatarData(instante(dias[dias.length - 1], '12:00')) + '</p></div>'
    + '<div class="acoes-linha">' + (pode.gerenciar() ? '<button class="btn sec" id="calendario">Calendário escolar</button>' : '') + (pode.agendar() ? '<button class="btn" id="agendar">+ Agendar</button>' : '') + '</div></header>'
    + '<div class="cartao filtros agenda-controles"><div class="acoes-linha"><button class="btn sec" id="ant" aria-label="Semana anterior">←</button><button class="btn sec" id="hoje">Hoje</button><button class="btn sec" id="prox" aria-label="Próxima semana">→</button></div>'
    + '<label class="campo"><span>Profissional</span><select id="prof"><option value="todas">Toda a equipe</option>' + especialistasDaEscola(escolaAtual()).map(u => '<option value="' + esc(u.id) + '"' + (S.agendaProf === u.id ? ' selected' : '') + '>' + esc(u.nome) + ' — ' + esc(ESPECIALIDADES[u.especialidade] || '') + '</option>').join('') + '</select></label>'
    + '<label class="check"><input type="checkbox" id="cancelados"' + (mostrarCancelados ? ' checked' : '') + '> Mostrar cancelados</label></div>'
    + (prof && !(prof.slots || []).length ? '<div class="alerta-caixa aviso">' + esc(prof.nome) + ' ainda não tem jornada cadastrada. A gestão define em Equipe.</div>' : '')
    + '<div class="semana" style="--dias:' + dias.length + '">' + dias.map(d => {
      const dow = new Date(instante(d, '12:00').getTime() - 3 * 3600000).getUTCDay();
      const doDia = visiveis.filter(a => diaMunicipal(a.inicio) === d);
      const faixas = (prof?.jornada || []).filter(f => f.dia === dow);
      const bloq = bloqueioDoDia(d, escolaAtual(), S.bloqueios);
      return '<section class="dia' + (d === hoje ? ' hoje' : '') + (d < hoje ? ' passado' : '') + (bloq ? ' bloqueado' : '') + '"><header><strong>' + DIAS[dow] + '</strong><span>' + formatarData(instante(d, '12:00')).slice(0, 5) + '</span></header>'
        + (bloq ? '<div class="faixa-bloqueio">Sem atendimento: ' + esc(bloq.motivo) + '</div>' : '')
        + (faixas.length ? '<div class="faixas">' + faixas.map(f => '<span>' + f.inicio + '–' + f.fim + (f.escola_id ? ' · ' + esc(escolaCurta(f.escola_id)) : '') + '</span>').join('') + '</div>' : prof ? '<div class="faixas vazio-dia">Sem jornada</div>' : '')
        + '<div class="lista-agenda compacta">' + doDia.map(a => linhaAgenda(a, { mostrarProf: !prof })).join('') + '</div>'
        + (pode.agendar() && d >= hoje && !bloq && (!prof || faixas.length) ? '<button class="link" data-agendar-dia="' + d + '">+ agendar</button>' : '')
        + '</section>';
    }).join('') + '</div>';

  ligarAgendamentos(main, lista);
  $('#ant', main).onclick = () => { S.agendaSemana = somarDias(ini, -7); render(main, vigente); };
  $('#prox', main).onclick = () => { S.agendaSemana = somarDias(ini, 7); render(main, vigente); };
  $('#hoje', main).onclick = () => { S.agendaSemana = inicioDaSemana(hoje); render(main, vigente); };
  $('#prof', main).onchange = ev => { S.agendaProf = ev.target.value; render(main, vigente); };
  $('#cancelados', main).onchange = ev => { mostrarCancelados = ev.target.checked; render(main, vigente); };
  $('#calendario', main)?.addEventListener('click', () => calendario(main, vigente));
  $('#agendar', main)?.addEventListener('click', () => formAgendar({ profissionalUid: prof?.id || '' }));
  $$('[data-agendar-dia]', main).forEach(b => b.onclick = () => formAgendar({ profissionalUid: prof?.id || '', dia: b.dataset.agendarDia }));
}

/** Calendário escolar: dias sem atendimento (férias, recesso, feriados, eventos). */
function calendario(main, vigente) {
  const hoje = diaMunicipal(Date.now());
  // agrupa dias consecutivos com o mesmo motivo e escola em períodos
  const ordenados = S.bloqueios.slice().sort((a, b) => a.dia - b.dia || a.escola_id.localeCompare(b.escola_id));
  const periodos = [];
  for (const b of ordenados) {
    const ult = periodos[periodos.length - 1];
    if (ult && ult.motivo === b.motivo && ult.escola_id === b.escola_id && ult.fimDia === b.dia - 1) { ult.ate = b.data; ult.fimDia = b.dia; ult.ids.push(b.id); }
    else periodos.push({ de: b.data, ate: b.data, fimDia: b.dia, motivo: b.motivo, escola_id: b.escola_id, ids: [b.id] });
  }
  const futuros = periodos.filter(p => p.ate >= hoje);
  const form = modal({
    titulo: 'Calendário escolar', largo: true, botao: 'Bloquear período',
    corpo: '<p class="nota">Dias sem atendimento não aparecem para agendamento (o servidor também recusa). Atendimentos já registrados não são afetados.</p>'
      + '<div class="grade">' + campo('de', 'De', { tipo: 'date', obrig: true, valor: hoje }) + campo('ate', 'Até', { tipo: 'date', valor: hoje })
      + opcoes('escola_id', 'Abrangência', [['', 'Toda a rede'], ...S.escolas.map(e => [e.id, e.nome])])
      + campo('motivo', 'Motivo', { obrig: true, extra: 'maxlength="120" placeholder="Ex.: Recesso escolar, Feriado de Natal, Conselho de classe"' }) + '</div>'
      + '<h3 class="subtitulo">Períodos bloqueados</h3>'
      + (futuros.length ? '<table class="tabela"><thead><tr><th>Período</th><th>Motivo</th><th>Abrangência</th><th></th></tr></thead><tbody>' + futuros.map((p, i) => '<tr><td>' + formatarData(instante(p.de, '12:00')) + (p.ate !== p.de ? ' a ' + formatarData(instante(p.ate, '12:00')) : '') + '</td><td>' + esc(p.motivo) + '</td><td>' + esc(p.escola_id ? escolaCurta(p.escola_id) : 'Toda a rede') + '</td><td><button type="button" class="link perigo" data-remover-periodo="' + i + '">Remover</button></td></tr>').join('') + '</tbody></table>' : vazio('Nenhum dia bloqueado.')),
    aoSalvar: async d => {
      const dias = diasDoBloqueio({ de: d.de, ate: d.ate || d.de, motivo: d.motivo });
      await dadosCal.criarBloqueios(dias, d.escola_id, d.motivo.trim(), idBloqueio, numeroDoDia);
      S.bloqueios = await dadosCal.listarBloqueios();
      aviso(dias.length + ' dia(s) bloqueado(s).'); render(main, vigente);
    }
  });
  $$('[data-remover-periodo]', form).forEach(b => b.onclick = async () => {
    const p = futuros[Number(b.dataset.removerPeriodo)]; b.disabled = true;
    try { await dadosCal.removerBloqueios(p.ids); S.bloqueios = await dadosCal.listarBloqueios(); aviso('Período liberado.'); document.getElementById('modal')?.remove(); render(main, vigente); }
    catch (e) { erro(e); b.disabled = false; }
  });
}
