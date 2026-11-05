// Frequência das especialistas: entrada/saída, ausências justificadas e relatório
// de horas previstas (jornada) x cumpridas. Atendimento realizado NÃO conta como presença.
import * as dados from '../dados.js';
import { S, pode, escolaCurta, especialistas, escolasDaPessoa } from '../estado.js';
import {
  ESPECIALIDADES, SITUACAO_FREQ, cargoDe, DIAS, diaMunicipal, diaDaSemana, somarDias, instante, horaMunicipal, formatarData, ms,
  jornadaPrevista, resumoFrequencia, formatarDataHora, minutosTrabalhados, formatarHoras, faixaDoHorario, csv
} from '../dominio.js';
import { esc, vazio, modal, campo, area, opcoes, aviso, erro, imprimir, $, $$ } from '../ui.js';
import { documento } from '../impressao.js';

let mes = '';
const fimDoMes = m => { let [a, n] = m.split('-').map(Number); n++; if (n === 13) { n = 1; a++; } return somarDias(a + '-' + String(n).padStart(2, '0') + '-01', -1); };
const dataBR = d => formatarData(instante(d, '12:00'));

export async function render(main, vigente) {
  const hoje = diaMunicipal(Date.now());
  mes ||= hoje.slice(0, 7);
  const de = mes + '-01', ate = fimDoMes(mes);
  if (S.perfil.perfil === 'especialista') return minhaFrequencia(main, vigente, { hoje, de, ate });
  return frequenciaDaEquipe(main, vigente, { hoje, de, ate });
}

const seletorMes = () => '<label class="campo"><span>Mês</span><input type="month" id="mes" value="' + esc(mes) + '"></label>';
const ligarMes = (main, vigente) => { $('#mes', main).onchange = ev => { if (ev.target.value) { mes = ev.target.value; render(main, vigente); } }; };
const metrica = (rot, v, cor) => '<div class="metrica m-' + cor + '"><span>' + rot + '</span><b>' + v + '</b></div>';

function tabelaDias({ registros, jornada, de, ate, hoje, editar = false }) {
  const previstos = new Map(jornadaPrevista({ jornada, de, ate, bloqueios: S.bloqueios }).map(p => [p.dia, p]));
  const porDia = new Map(registros.map(r => [r.dia, r]));
  const dias = [...new Set([...previstos.keys(), ...porDia.keys()])].sort();
  if (!dias.length) return vazio('Sem jornada prevista nem registros neste mês.');
  return '<table class="tabela"><thead><tr><th>Dia</th><th>Previsto</th><th>Situação</th><th>Entrada</th><th>Saída</th><th>Cumprido</th><th>Observação</th>' + (editar ? '<th></th>' : '') + '</tr></thead><tbody>'
    + dias.map(d => {
      const p = previstos.get(d), r = porDia.get(d), passou = d < hoje;
      const sit = r ? SITUACAO_FREQ[r.situacao] : passou && p ? '<span class="selo s-falta">Sem registro</span>' : '—';
      return '<tr' + (!r && passou && p ? ' class="linha-alerta"' : '') + '><td>' + DIAS[diaDaSemana(d)].slice(0, 3) + ' ' + dataBR(d).slice(0, 5) + '</td><td>' + (p ? formatarHoras(p.minutos) : '—') + '</td><td>' + sit + '</td>'
        + '<td>' + (r?.entrada ? esc(horaMunicipal(r.entrada)) : '—') + '</td><td>' + (r?.saida ? esc(horaMunicipal(r.saida)) : r?.situacao === 'presente' && passou ? '<span class="nota">não registrada</span>' : '—') + '</td>'
        + '<td>' + (r ? formatarHoras(minutosTrabalhados(r)) : '—') + '</td><td><small>' + esc([r?.escola_id ? escolaCurta(r.escola_id) : '', r?.justificativa, r?.ajuste_motivo ? 'Ajuste: ' + r.ajuste_motivo : ''].filter(Boolean).join(' · ')) + '</small></td>'
        + (editar ? '<td><button class="link" data-ajustar="' + esc(d) + '">' + (r ? 'Corrigir' : 'Lançar') + '</button></td>' : '') + '</tr>';
    }).join('') + '</tbody></table>';
}

// ---------- visão da especialista ----------
async function minhaFrequencia(main, vigente, { hoje, de, ate }) {
  const eu = S.perfil, uid = S.user.uid;
  const registros = await dados.listarFrequencias({ uid, de, ate });
  const deHoje = (hoje >= de && hoje <= ate) ? registros.find(r => r.dia === hoje) : (await dados.listarFrequencias({ uid, de: hoje, ate: hoje }))[0];
  if (!vigente()) return;
  const r = resumoFrequencia({ registros, jornada: eu.jornada || [], de, ate, bloqueios: S.bloqueios, hoje });
  const faixa = faixaDoHorario(eu.jornada || [], Date.now());
  const escolas = escolasDaPessoa();
  let cartaoHoje;
  if (!deHoje) cartaoHoje = '<div class="cartao-ponto"><div><strong>Hoje, ' + esc(dataBR(hoje)) + '</strong><p class="nota">' + (faixa ? 'Jornada agora: ' + esc(faixa.inicio + '–' + faixa.fim) + (faixa.escola_id ? ' em ' + esc(escolaCurta(faixa.escola_id)) : '') : 'Fora do horário da jornada.') + '</p></div>'
    + '<form id="form-entrada" class="acoes-linha"><select name="escola_id" aria-label="Local de trabalho"><option value="">Local não informado</option>' + escolas.map(e => '<option value="' + esc(e.id) + '"' + (faixa?.escola_id === e.id ? ' selected' : '') + '>' + esc(escolaCurta(e.id)) + '</option>').join('') + '</select>'
    + '<button class="btn" type="submit">Registrar entrada</button></form></div>';
  else if (deHoje.situacao === 'presente' && !deHoje.saida) cartaoHoje = '<div class="cartao-ponto em-curso"><div><strong>Entrada às ' + esc(horaMunicipal(deHoje.entrada)) + '</strong><p class="nota">' + esc(deHoje.escola_id ? escolaCurta(deHoje.escola_id) : 'Local não informado') + '</p></div><button class="btn" id="saida">Registrar saída</button></div>';
  else cartaoHoje = '<div class="cartao-ponto concluido"><div><strong>' + (deHoje.situacao === 'presente' ? 'Hoje: ' + esc(horaMunicipal(deHoje.entrada)) + ' às ' + esc(horaMunicipal(deHoje.saida)) + ' (' + formatarHoras(minutosTrabalhados(deHoje)) + ')' : 'Hoje: ' + esc(SITUACAO_FREQ[deHoje.situacao])) + '</strong><p class="nota">Registro do dia concluído.</p></div></div>';

  main.innerHTML = '<header class="pagina-topo"><div><h1>Minha frequência</h1><p>Entrada e saída no horário do servidor. O atendimento registrado não substitui o ponto.</p></div><div class="acoes-linha"><button class="btn sec" id="ausencia">Informar ausência</button></div></header>'
    + '<section class="cartao">' + cartaoHoje + '</section>'
    + '<section class="cartao"><header class="cartao-topo"><h2>Mês</h2>' + seletorMes() + '</header>'
    + '<div class="metricas">' + metrica('Horas previstas', formatarHoras(r.minutosPrevistos), 'azul') + metrica('Horas cumpridas', formatarHoras(r.minutosCumpridos), 'verde')
    + metrica('Faltas', r.faltas, 'ambar') + metrica('Justificadas', r.justificadas, 'roxo') + '</div>'
    + (r.semRegistro.length ? '<p class="alerta-caixa aviso">' + r.semRegistro.length + ' dia(s) da jornada sem registro: ' + r.semRegistro.map(dataBR).map(x => x.slice(0, 5)).join(', ') + '. Informe a ausência ou peça a correção à administração.</p>' : '')
    + tabelaDias({ registros, jornada: eu.jornada || [], de, ate, hoje }) + '</section>';
  ligarMes(main, vigente);
  $('#form-entrada', main)?.addEventListener('submit', async ev => {
    ev.preventDefault(); const b = ev.target.querySelector('button'); b.disabled = true;
    if (dados.semInternet()) { b.disabled = false; return aviso('Sem internet: o ponto usa o relógio do servidor e precisa de conexão.', 'erro'); }
    try { await dados.registrarEntrada(eu, ev.target.escola_id.value); aviso('Entrada registrada.'); render(main, vigente); } catch (e) { b.disabled = false; erro(e); }
  });
  $('#saida', main)?.addEventListener('click', async ev => {
    ev.target.disabled = true;
    if (dados.semInternet()) { ev.target.disabled = false; return aviso('Sem internet: o ponto usa o relógio do servidor e precisa de conexão.', 'erro'); }
    try { await dados.registrarSaida(deHoje); aviso('Saída registrada.'); render(main, vigente); } catch (e) { ev.target.disabled = false; erro(e); }
  });
  $('#ausencia', main).onclick = () => modal({
    titulo: 'Informar ausência', botao: 'Registrar',
    corpo: '<div class="grade">' + campo('dia', 'Dia', { tipo: 'date', valor: hoje, obrig: true }) + opcoes('situacao', 'Tipo', [['atestado', 'Atestado / licença'], ['falta', 'Falta']], { valor: 'atestado' })
      + opcoes('escola_id', 'Local em que trabalharia', [['', 'Não se aplica'], ...escolas.map(e => [e.id, escolaCurta(e.id)])]) + '</div>'
      + area('justificativa', 'Justificativa', { obrig: true, max: 500, linhas: 2, dica: 'Ex.: atestado médico de 1 dia; consulta; curso de formação' })
      + '<p class="nota">Dia já registrado não pode ser alterado aqui: peça a correção à administração. Não descreva diagnóstico.</p>',
    aoSalvar: async d => {
      if (!d.justificativa.trim()) throw Error('Escreva a justificativa.');
      await dados.informarAusencia(eu, { dia: d.dia, situacao: d.situacao, justificativa: d.justificativa.trim(), escola_id: d.escola_id });
      aviso('Ausência registrada.'); render(main, vigente);
    }
  });
}

// ---------- visão da gestão ----------
async function frequenciaDaEquipe(main, vigente, { hoje, de, ate }) {
  const equipe = especialistas();
  const [registros, atendimentos] = await Promise.all([
    dados.listarFrequencias({ de, ate }),
    dados.listarAtendimentos({ de: instante(de, '00:00'), ate: instante(somarDias(ate, 1), '00:00') })
  ]);
  if (!vigente()) return;
  const linhas = equipe.map(u => {
    const regs = registros.filter(r => r.uid === u.id);
    const r = resumoFrequencia({ registros: regs, jornada: u.jornada || [], de, ate, bloqueios: S.bloqueios, hoje });
    const minAt = atendimentos.filter(a => a.profissional_uid === u.id && a.situacao !== 'anulado').reduce((s, a) => s + (Number(a.duracao_min) || 0), 0);
    return { u, regs, r, minAt };
  });
  const pct = x => x.r.minutosPrevistos ? Math.round(x.r.minutosCumpridos / x.r.minutosPrevistos * 100) + '%' : '—';
  main.innerHTML = '<header class="pagina-topo"><div><h1>Frequência da equipe</h1><p>Horas previstas pela jornada (sem os dias bloqueados no calendário) e cumpridas pelo ponto. Horas em atendimento são só referência.</p></div>'
    + '<div class="acoes-linha"><button class="btn sec" id="csv">Planilha (CSV)</button><button class="btn" id="imprimir">Imprimir / PDF</button></div></header>'
    + '<section class="cartao"><header class="cartao-topo"><h2>' + esc(dataBR(de).slice(3)) + '</h2>' + seletorMes() + '</header>'
    + (linhas.length ? '<table class="tabela"><thead><tr><th>Profissional</th><th>Dias previstos</th><th>Presenças</th><th>Faltas</th><th>Justificadas</th><th>Sem registro</th><th>Horas previstas</th><th>Horas cumpridas</th><th>%</th><th>Horas em atendimento</th><th></th></tr></thead><tbody>'
      + linhas.map((x, i) => '<tr><td><strong>' + esc(x.u.nome) + '</strong><br><small class="nota">' + esc(ESPECIALIDADES[x.u.especialidade] || '') + '</small></td><td class="num">' + x.r.diasPrevistos + '</td><td class="num">' + x.r.presencas + '</td><td class="num">' + x.r.faltas + '</td><td class="num">' + x.r.justificadas + '</td>'
        + '<td class="num">' + (x.r.semRegistro.length ? '<span class="selo s-falta">' + x.r.semRegistro.length + '</span>' : '0') + '</td><td class="num">' + formatarHoras(x.r.minutosPrevistos) + '</td><td class="num">' + formatarHoras(x.r.minutosCumpridos) + '</td><td class="num">' + pct(x) + '</td><td class="num">' + formatarHoras(x.minAt) + '</td>'
        + '<td><button class="btn sec pequeno" data-detalhe="' + i + '">Dias</button></td></tr>').join('') + '</tbody></table>' : vazio('Nenhuma especialista ativa.'))
    + '</section>';
  ligarMes(main, vigente);
  $$('[data-detalhe]', main).forEach(b => b.onclick = () => detalhe(linhas[Number(b.dataset.detalhe)], { hoje, de, ate }, main, vigente));
  $('#csv', main).onclick = () => {
    const tab = [['Profissional', 'Especialidade', 'Dias previstos', 'Presenças', 'Faltas', 'Justificadas', 'Dias sem registro', 'Horas previstas', 'Horas cumpridas', 'Horas em atendimento']]
      .concat(linhas.map(x => [x.u.nome, ESPECIALIDADES[x.u.especialidade] || '', x.r.diasPrevistos, x.r.presencas, x.r.faltas, x.r.justificadas, x.r.semRegistro.length, (x.r.minutosPrevistos / 60).toFixed(1).replace('.', ','), (x.r.minutosCumpridos / 60).toFixed(1).replace('.', ','), (x.minAt / 60).toFixed(1).replace('.', ',')]));
    const url = URL.createObjectURL(new Blob([csv(tab)], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'frequencia_' + mes + '.csv' }); document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };
  $('#imprimir', main).onclick = () => imprimir('Frequência ' + mes, documento({ titulo: 'Frequência da equipe de especialistas', subtitulo: 'Mês de referência: ' + dataBR(de).slice(3), lgpd: false,
    corpo: '<table class="doc-tab"><thead><tr><th>Profissional</th><th class="num">Dias previstos</th><th class="num">Presenças</th><th class="num">Faltas</th><th class="num">Justificadas</th><th class="num">Sem registro</th><th class="num">Horas previstas</th><th class="num">Horas cumpridas</th></tr></thead><tbody>'
      + linhas.map(x => '<tr><td>' + esc(x.u.nome) + '<br><small>' + esc(ESPECIALIDADES[x.u.especialidade] || '') + '</small></td><td class="num">' + x.r.diasPrevistos + '</td><td class="num">' + x.r.presencas + '</td><td class="num">' + x.r.faltas + '</td><td class="num">' + x.r.justificadas + '</td><td class="num">' + x.r.semRegistro.length + '</td><td class="num">' + formatarHoras(x.r.minutosPrevistos) + '</td><td class="num">' + formatarHoras(x.r.minutosCumpridos) + '</td></tr>').join('')
      + '</tbody></table><p class="doc-nota">Horas previstas pela jornada cadastrada, sem os dias bloqueados no calendário escolar. Horas cumpridas pelo registro de entrada e saída.</p>'
      + '<p class="doc-local">Frei Inocêncio/MG, ' + esc(formatarData(Date.now())) + '.</p><div class="assinaturas"><div class="assinatura"><span></span><strong>Secretaria Municipal de Educação</strong></div></div>' }));
}

function detalhe(x, { hoje, de, ate }, main, vigente) {
  const editar = pode.gerenciar();
  const form = modal({ titulo: 'Frequência — ' + x.u.nome, largo: true, somenteLeitura: true, corpo: tabelaDias({ registros: x.regs, jornada: x.u.jornada || [], de, ate, hoje, editar }) });
  $$('[data-ajustar]', form).forEach(b => b.onclick = () => ajustar(x.u, b.dataset.ajustar, x.regs.find(r => r.dia === b.dataset.ajustar), main, vigente));
}

function ajustar(u, dia, r, main, vigente) {
  const h = v => v ? horaMunicipal(v) : '';
  modal({
    titulo: (r ? 'Corrigir ' : 'Lançar ') + dataBR(dia) + ' — ' + u.nome, botao: 'Salvar',
    corpo: '<div class="grade">' + opcoes('situacao', 'Situação', Object.entries(SITUACAO_FREQ), { valor: r?.situacao || 'presente' })
      + opcoes('escola_id', 'Local', [['', 'Não informado'], ...S.escolas.map(e => [e.id, escolaCurta(e.id)])], { valor: r?.escola_id || '' })
      + campo('entrada', 'Entrada', { tipo: 'time', valor: h(r?.entrada) }) + campo('saida', 'Saída', { tipo: 'time', valor: h(r?.saida) }) + '</div>'
      + area('justificativa', 'Justificativa', { valor: r?.justificativa || '', max: 500, linhas: 2 })
      + campo('ajuste_motivo', 'Motivo do lançamento / correção', { obrig: true, largo: true, extra: 'maxlength="300"', dica: 'Fica registrado com seu nome. Ex.: esqueceu de registrar a saída' }),
    aoSalvar: async d => {
      const entrada = d.situacao === 'presente' && d.entrada ? instante(dia, d.entrada) : null, saida = d.situacao === 'presente' && d.saida ? instante(dia, d.saida) : null;
      if (d.situacao === 'presente' && !entrada) throw Error('Informe a hora de entrada.');
      if (entrada && saida && ms(saida) <= ms(entrada)) throw Error('A saída deve ser depois da entrada.');
      await dados.ajustarFrequencia(u, dia, { ...d, justificativa: d.justificativa.trim(), ajuste_motivo: d.ajuste_motivo.trim(), entrada, saida }, r);
      aviso('Frequência salva.'); render(main, vigente);
    }
  });
}
