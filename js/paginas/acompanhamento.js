// Acompanhamento do dia (gestão e direção): situação de cada consulta de hoje, em tempo real.
// Uma única escuta do Firestore nas consultas do dia (lê uma vez e depois só o que mudar);
// a passagem do tempo (próxima → no horário → passou do horário) é recalculada pelo relógio, sem leituras.
import * as dados from '../dados.js';
import { S, escolaCurta, estudante, escopoEscolas, escolaAtual } from '../estado.js';
import { abrirConsulta } from '../formularios.js';
import { ESPECIALIDADES, ESTADOS_CONSULTA, ms, diaMunicipal, somarDias, instante, horaMunicipal, formatarData, resumoDoDia } from '../dominio.js';
import { esc, vazio, $, $$ } from '../ui.js';
import { barra100 } from '../grafico.js';

let filtroProf = '', mostrarCanceladas = false;
const SELO = { aguardando_registro: 'Sem registro', no_horario: 'Não iniciada' };
const CLASSE = { aguardando_registro: 'ac-atrasada', no_horario: 'ac-horario', em_atendimento: 'ac-atendimento', chegou: 'ac-chegou', proxima: 'ac-proxima', realizado: 'ac-realizada', falta: 'ac-falta', cancelado: 'ac-cancelada' };

export async function render(main, vigente, aoSair = () => {}) {
  const hoje = diaMunicipal(Date.now());
  const escolas = escolaAtual() ? [escolaAtual()] : escopoEscolas() || undefined;
  let lista = null, atualizado = null, doCache = false, falha = null;

  main.innerHTML = '<header class="pagina-topo"><div><h1>Acompanhamento do dia</h1><p>' + esc(formatarData(Date.now())) + (escolaAtual() ? ' · ' + esc(escolaCurta(escolaAtual())) : ' · toda a rede')
    + ' · cada consulta muda de situação sozinha quando a especialista inicia, registra ou marca falta.</p></div>'
    + '<span class="ao-vivo" id="ao-vivo" role="status">Conectando…</span></header><div id="acomp" class="acomp"><div class="carregando">Carregando as consultas de hoje…</div></div>';

  const desenhar = () => {
    if (!vigente() || !lista) return;
    const agora = Date.now(), base = lista.filter(a => !filtroProf || a.profissional_uid === filtroProf);
    const r = resumoDoDia(base.filter(a => mostrarCanceladas || a.status !== 'cancelado'), agora), t = r.totais;
    const todosProfs = [...new Map(lista.map(a => [a.profissional_uid, a.profissional_nome])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'pt-BR'));
    const card = (rot, n, cls, dica) => '<div class="metrica ' + cls + '"><span>' + rot + '</span><b>' + n + '</b>' + (dica ? '<small class="delta">' + dica + '</small>' : '') + '</div>';
    const linha = a => '<button type="button" class="ac-linha ' + CLASSE[a.estado] + '" data-ag="' + esc(a.id) + '">'
      + '<span class="ac-hora">' + esc(horaMunicipal(a.inicio)) + '<small>' + (a.duracao_min || 30) + ' min</small></span>'
      + '<span class="ac-quem"><strong>' + esc(estudante(a.estudante_id)?.nome || 'Aluno') + '</strong><small>' + esc(escolaCurta(a.escola_id)) + (a.codigo ? ' · ' + esc(a.codigo) : '') + '</small></span>'
      + '<span class="ac-detalhe">' + detalhe(a) + '</span><span class="ac-selo">' + esc(SELO[a.estado] || ESTADOS_CONSULTA[a.estado]) + '</span></button>';
    $('#acomp', main).innerHTML = (falha ? '<div class="alerta-caixa erro">Não foi possível acompanhar em tempo real: ' + esc(falha) + '</div>' : '')
      + '<div class="cartao filtros"><label class="campo"><span>Profissional</span><select id="ac-prof"><option value="">Toda a equipe</option>'
      + todosProfs.map(([id, nome]) => '<option value="' + esc(id) + '"' + (filtroProf === id ? ' selected' : '') + '>' + esc(nome) + '</option>').join('') + '</select></label>'
      + '<label class="check"><input type="checkbox" id="ac-canc"' + (mostrarCanceladas ? ' checked' : '') + '> Mostrar canceladas</label></div>'
      + '<div class="metricas">' + card('Consultas hoje', r.ativas, 'm-azul', r.ocorridas + ' já ocorridas')
      + card('Realizadas', t.realizado, 'ac-m-realizada') + card('Não compareceu', t.falta, 'ac-m-falta')
      + card('Em atendimento agora', t.em_atendimento, 'ac-m-atendimento', t.no_horario ? t.no_horario + ' no horário sem início' : '')
      + card('Passou do horário, sem registro', t.aguardando_registro, 'ac-m-atrasada', t.aguardando_registro ? 'precisam de registro' : 'tudo em dia')
      + card('Próximas', t.proxima + t.chegou, 'm-roxo', t.chegou ? t.chegou + ' aluno(s) já chegaram' : '') + '</div>'
      + (r.ativas ? '<section class="cartao"><h2>Andamento do dia</h2>' + barra100(['realizado', 'falta', 'em_atendimento', 'no_horario', 'aguardando_registro', 'chegou', 'proxima'].map(k => ({ valor: t[k], classe: CLASSE[k], rotulo: ESTADOS_CONSULTA[k] })), { altura: 16 })
        + '<div class="legenda pequena">' + ['realizado', 'falta', 'em_atendimento', 'no_horario', 'aguardando_registro', 'proxima'].map(k => '<span><i class="' + CLASSE[k] + '"></i>' + ESTADOS_CONSULTA[k] + '</span>').join('') + '</div></section>' : '')
      + (t.aguardando_registro ? '<div class="alerta-caixa aviso"><strong>' + t.aguardando_registro + ' consulta(s) passaram do horário sem registro.</strong> A especialista ainda não informou se o aluno compareceu. Clique na consulta para ver os detalhes.</div>' : '')
      + (r.profissionais.length ? '<div class="ac-grade">' + r.profissionais.map(p => {
        const tt = p.itens.reduce((m, a) => (m[a.estado] = (m[a.estado] || 0) + 1, m), {});
        return '<section class="cartao ac-prof esp-' + esc(p.especialidade) + '"><header class="cartao-topo"><div><h2>' + esc(p.nome) + '</h2><small class="nota">' + esc(ESPECIALIDADES[p.especialidade] || '') + ' · ' + p.itens.length + ' consulta(s)</small></div>'
          + (tt.aguardando_registro ? '<span class="ac-alerta">' + tt.aguardando_registro + ' sem registro</span>' : tt.em_atendimento ? '<span class="ac-ok">Em atendimento</span>' : '') + '</header>'
          + '<div class="ac-lista">' + p.itens.map(linha).join('') + '</div></section>';
      }).join('') + '</div>' : '<section class="cartao">' + vazio('Nenhuma consulta agendada para hoje' + (escolaAtual() ? ' nesta instituição' : '') + '.') + '</section>');
    $('#ac-prof', main).onchange = e => { filtroProf = e.target.value; desenhar(); };
    $('#ac-canc', main).onchange = e => { mostrarCanceladas = e.target.checked; desenhar(); };
    $$('[data-ag]', main).forEach(b => b.onclick = () => abrirConsulta(lista.find(a => a.id === b.dataset.ag)));
    const vivo = $('#ao-vivo', main);
    vivo.className = 'ao-vivo' + (doCache || !navigator.onLine ? ' off' : '');
    vivo.textContent = doCache || !navigator.onLine ? 'Sem conexão · mostrando dados guardados' : 'Ao vivo · atualizado às ' + horaMunicipal(atualizado) + ':' + String(new Date(atualizado).getSeconds()).padStart(2, '0');
  };

  const parar = dados.observarAgendamentos({ de: instante(hoje, '00:00'), ate: instante(somarDias(hoje, 1), '00:00'), escolas }, (itens, info) => {
    lista = itens; atualizado = Date.now(); doCache = info.doCache; falha = null; desenhar();
  }, e => { falha = String(e?.code || '').includes('permission') ? 'sua conta não tem permissão para estes dados.' : (e?.message || 'erro de conexão'); if (!lista) lista = []; desenhar(); });
  // Relógio: a cada 30 s recalcula as situações que dependem do horário (sem novas leituras).
  const relogio = setInterval(desenhar, 30000);
  aoSair(() => { parar(); clearInterval(relogio); });
}

function detalhe(a) {
  if (a.status === 'realizado') return 'Realizada' + (a.iniciado_em ? ' · início ' + esc(horaMunicipal(a.iniciado_em)) : '') + (a.alterado_em ? ' · registrada ' + esc(horaMunicipal(a.alterado_em)) : '');
  if (a.status === 'falta') return 'Falta registrada' + (a.alterado_em ? ' às ' + esc(horaMunicipal(a.alterado_em)) : '');
  if (a.status === 'cancelado') return esc(a.motivo || 'Cancelada');
  if (a.iniciado_em) return 'Iniciada às ' + esc(horaMunicipal(a.iniciado_em));
  if (a.estado === 'aguardando_registro') { const min = Math.max(0, Math.round((Date.now() - ms(a.inicio) - (a.duracao_min || 30) * 60000) / 60000)); return 'Terminou há ' + (min >= 60 ? Math.floor(min / 60) + ' h ' + (min % 60) + ' min' : min + ' min'); }
  if (a.chegada_em) return 'Aluno chegou às ' + esc(horaMunicipal(a.chegada_em));
  return '';
}
