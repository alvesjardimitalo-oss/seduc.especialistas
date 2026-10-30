import * as dados from '../dados.js';
import { S, pode, escolaCurta, especialistas, escopoEscolas } from '../estado.js';
import { formAgendar } from '../formularios.js';
import { ESPECIALIDADES, DIAS, diaMunicipal, inicioDaSemana, somarDias, instante, formatarData, ms } from '../dominio.js';
import { esc, $, $$ } from '../ui.js';
import { linhaAgenda, ligarAgendamentos } from './painel.js';

let mostrarCancelados = false;

export async function render(main, vigente) {
  const hoje = diaMunicipal(Date.now());
  if (!S.agendaSemana) S.agendaSemana = inicioDaSemana(hoje);
  if (S.agendaProf === '' && S.perfil.perfil === 'especialista') S.agendaProf = S.user.uid;
  const ini = S.agendaSemana, fim = somarDias(ini, 7);
  const prof = S.agendaProf && S.agendaProf !== 'todas' ? S.usuarios.find(u => u.id === S.agendaProf) : null;
  const filtro = prof ? { profissional: prof.id } : { escolas: escopoEscolas() || undefined };
  const lista = await dados.listarAgendamentos({ ...filtro, de: instante(ini, '00:00'), ate: instante(fim, '00:00') });
  if (!vigente()) return;
  const visiveis = lista.filter(a => mostrarCancelados || a.status !== 'cancelado').sort((a, b) => ms(a.inicio) - ms(b.inicio));
  const temSabado = visiveis.some(a => diaMunicipal(a.inicio) === somarDias(ini, 6)) || (prof?.jornada || []).some(f => f.dia === 6);
  const dias = [1, 2, 3, 4, 5, ...(temSabado ? [6] : [])].map(n => somarDias(ini, n));

  main.innerHTML = '<header class="pagina-topo"><div><h1>Agenda</h1><p>Semana de ' + formatarData(instante(dias[0], '12:00')) + ' a ' + formatarData(instante(dias[dias.length - 1], '12:00')) + '</p></div>'
    + '<div class="acoes-linha">' + (pode.agendar() ? '<button class="btn" id="agendar">+ Agendar</button>' : '') + '</div></header>'
    + '<div class="cartao filtros agenda-controles"><div class="acoes-linha"><button class="btn sec" id="ant" aria-label="Semana anterior">←</button><button class="btn sec" id="hoje">Hoje</button><button class="btn sec" id="prox" aria-label="Próxima semana">→</button></div>'
    + '<label class="campo"><span>Profissional</span><select id="prof"><option value="todas">Toda a equipe</option>' + especialistas().map(u => '<option value="' + esc(u.id) + '"' + (S.agendaProf === u.id ? ' selected' : '') + '>' + esc(u.nome) + ' — ' + esc(ESPECIALIDADES[u.especialidade] || '') + '</option>').join('') + '</select></label>'
    + '<label class="check"><input type="checkbox" id="cancelados"' + (mostrarCancelados ? ' checked' : '') + '> Mostrar cancelados</label></div>'
    + (prof && !(prof.slots || []).length ? '<div class="alerta-caixa aviso">' + esc(prof.nome) + ' ainda não tem jornada cadastrada. A gestão define em Equipe.</div>' : '')
    + '<div class="semana" style="--dias:' + dias.length + '">' + dias.map(d => {
      const dow = new Date(instante(d, '12:00').getTime() - 3 * 3600000).getUTCDay();
      const doDia = visiveis.filter(a => diaMunicipal(a.inicio) === d);
      const faixas = (prof?.jornada || []).filter(f => f.dia === dow);
      return '<section class="dia' + (d === hoje ? ' hoje' : '') + (d < hoje ? ' passado' : '') + '"><header><strong>' + DIAS[dow] + '</strong><span>' + formatarData(instante(d, '12:00')).slice(0, 5) + '</span></header>'
        + (faixas.length ? '<div class="faixas">' + faixas.map(f => '<span>' + f.inicio + '–' + f.fim + (f.escola_id ? ' · ' + esc(escolaCurta(f.escola_id)) : '') + '</span>').join('') + '</div>' : prof ? '<div class="faixas vazio-dia">Sem jornada</div>' : '')
        + '<div class="lista-agenda compacta">' + doDia.map(a => linhaAgenda(a, { mostrarProf: !prof })).join('') + '</div>'
        + (pode.agendar() && d >= hoje && (!prof || faixas.length) ? '<button class="link" data-agendar-dia="' + d + '">+ agendar</button>' : '')
        + '</section>';
    }).join('') + '</div>';

  ligarAgendamentos(main, lista);
  $('#ant', main).onclick = () => { S.agendaSemana = somarDias(ini, -7); render(main, vigente); };
  $('#prox', main).onclick = () => { S.agendaSemana = somarDias(ini, 7); render(main, vigente); };
  $('#hoje', main).onclick = () => { S.agendaSemana = inicioDaSemana(hoje); render(main, vigente); };
  $('#prof', main).onchange = ev => { S.agendaProf = ev.target.value; render(main, vigente); };
  $('#cancelados', main).onchange = ev => { mostrarCancelados = ev.target.checked; render(main, vigente); };
  $('#agendar', main)?.addEventListener('click', () => formAgendar({ profissionalUid: prof?.id || '' }));
  $$('[data-agendar-dia]', main).forEach(b => b.onclick = () => formAgendar({ profissionalUid: prof?.id || '', dia: b.dataset.agendarDia }));
}
