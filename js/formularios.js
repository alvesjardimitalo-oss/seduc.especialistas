// Formulários compartilhados entre as páginas.
import * as dados from './dados.js';
import { S, pode, nomeEscola, escolaCurta, especialistas, estudante, escolasVisiveis, invalidarAtendimentos } from './estado.js';
import {
  ESPECIALIDADES, TIPOS_ATENDIMENTO, EVOLUCAO, STATUS_AGENDA, LIMITES, validarEstudante, possiveisDuplicados, validarRegistro,
  instante, diaMunicipal, horaMunicipal, horariosLivres, validarAgendamento, somarDias, formatarData, formatarDataHora,
  faixaDoHorario, normalizar, ms, idade
} from './dominio.js';
import { esc, modal, campo, area, opcoes, ativarContadores, aviso, erro, $, $$ } from './ui.js';

export const eventos = { aoMudar: () => {} };
const mudou = () => eventos.aoMudar();
export function irPara(hash) { if (location.hash === hash) mudou(); else location.hash = hash; }
const hoje = () => diaMunicipal(Date.now());

// ---------- seletor de aluno com busca ----------
function seletorAluno(nome = 'estudante_id', valor = '') {
  const lista = S.estudantes.filter(e => (e.situacao || 'ativo') === 'ativo' && escolasVisiveis().some(x => x.id === e.escola_id))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  if (valor) {
    const e = estudante(valor);
    return '<div class="campo largo"><span>Aluno</span><div class="aluno-fixo"><strong>' + esc(e?.nome) + '</strong> · ' + esc(escolaCurta(e?.escola_id)) + '</div><input type="hidden" name="' + nome + '" value="' + esc(valor) + '"></div>';
  }
  return '<label class="campo largo"><span>Aluno <b class="obrig">*</b></span><input type="search" data-busca-aluno placeholder="Digite parte do nome" autocomplete="off">'
    + '<select name="' + nome + '" required size="5" data-lista-aluno>' + lista.map(e => '<option value="' + esc(e.id) + '" data-n="' + esc(normalizar(e.nome)) + '">' + esc(e.nome) + ' — ' + esc(escolaCurta(e.escola_id)) + '</option>').join('') + '</select>'
    + '<small>Não encontrou? Cadastre o aluno primeiro em Alunos.</small></label>';
}
function ativarSeletorAluno(form, aoEscolher = () => {}) {
  const busca = $('[data-busca-aluno]', form), sel = $('[data-lista-aluno]', form);
  if (!busca || !sel) return;
  busca.oninput = () => {
    const b = normalizar(busca.value); let primeiro = null;
    for (const o of sel.options) { const ok = !b || o.dataset.n.includes(b); o.hidden = !ok; if (ok && !primeiro) primeiro = o; }
    if (primeiro && (sel.selectedOptions[0]?.hidden || !sel.value)) sel.value = primeiro.value;
    aoEscolher(sel.value);
  };
  sel.onchange = () => aoEscolher(sel.value);
}

// ---------- cadastro de aluno ----------
export async function formAluno(id = '') {
  if (!pode.cadastrarAluno()) return;
  const e = id ? estudante(id) : {};
  let privado = {}, clinico = {};
  try {
    if (id) [privado, clinico] = await Promise.all([dados.lerDoc('estudantes_privado', id), pode.clinico() ? dados.lerDoc('estudantes_clinico', id) : null]).then(r => r.map(x => x || {}));
  } catch (err) { erro(err); }
  const escolas = escolasVisiveis().map(x => [x.id, x.nome]);
  const corpo = '<fieldset><legend>Identificação</legend><div class="grade">'
    + campo('nome', 'Nome completo', { valor: e.nome, obrig: true, largo: true, extra: 'maxlength="180" autocomplete="off"' })
    + campo('nascimento', 'Data de nascimento', { tipo: 'date', valor: e.nascimento })
    + opcoes('escola_id', 'Escola', escolas, { valor: e.escola_id, obrig: true, vazio: 'Selecione' })
    + campo('turma', 'Turma / ano', { valor: e.turma, extra: 'maxlength="80"', dica: 'Ex.: 2º ano B' })
    + opcoes('turno', 'Turno', [['', 'Não informado'], ['manha', 'Manhã'], ['tarde', 'Tarde'], ['integral', 'Integral']], { valor: e.turno || '' })
    + campo('ano_letivo', 'Ano letivo', { tipo: 'number', valor: e.ano_letivo || new Date().getFullYear(), extra: 'min="2020" max="2100"' })
    + '</div></fieldset>'
    + '<fieldset><legend>Responsável</legend><div class="grade">'
    + campo('responsavel', 'Nome do responsável', { valor: privado.responsavel, extra: 'maxlength="180"' })
    + campo('parentesco', 'Parentesco', { valor: privado.parentesco, extra: 'maxlength="60"', dica: 'Mãe, pai, avó…' })
    + campo('telefone', 'Telefone', { tipo: 'tel', valor: privado.telefone, extra: 'maxlength="40"' })
    + campo('cartao_sus', 'Cartão SUS', { valor: privado.cartao_sus, extra: 'maxlength="20" inputmode="numeric"' })
    + campo('endereco', 'Endereço', { valor: privado.endereco, largo: true, extra: 'maxlength="300"' })
    + '</div></fieldset>'
    + '<fieldset><legend>Encaminhamento da escola</legend>'
    + area('motivo_encaminhamento', 'Motivo / queixa apresentada pela escola', { valor: privado.motivo_encaminhamento, max: 2000, linhas: 3, dica: 'O que a escola observou e o que solicita' })
    + '</fieldset>'
    + (pode.clinico() ? '<fieldset><legend>Informações de saúde (somente equipe)</legend><div class="grade">'
      + campo('necessidade_informada', 'Condição / diagnóstico informado', { valor: clinico.necessidade_informada, largo: true, extra: 'maxlength="1000"', dica: 'Transcreva laudo ou informação recebida; não é diagnóstico do sistema' })
      + campo('fonte', 'Fonte da informação', { valor: clinico.fonte, largo: true, extra: 'maxlength="300"', dica: 'Ex.: laudo neuropediatra de 03/2025' })
      + '</div>' + area('observacoes', 'Observações relevantes (medicação, cuidados)', { valor: clinico.observacoes, max: 3000, linhas: 3 }) + '</fieldset>' : '');
  const form = modal({
    titulo: id ? 'Editar cadastro' : 'Cadastrar aluno', corpo, largo: true, botao: id ? 'Salvar alterações' : 'Cadastrar',
    aoSalvar: async d => {
      const est = validarEstudante(d);
      if (!id) {
        const dup = possiveisDuplicados(S.estudantes, est);
        if (dup.length && !confirm('Já existe aluno com o mesmo nome (' + dup.map(x => escolaCurta(x.escola_id)).join(', ') + '). Cadastrar mesmo assim?')) throw Error('Cadastro não realizado: confira o aluno existente.');
      }
      if (id && e.escola_id !== est.escola_id) est.escolas_anteriores = [...(e.escolas_anteriores || []), { escola_id: e.escola_id, ate: hoje() }];
      else if (id) est.escolas_anteriores = e.escolas_anteriores || [];
      const privadoNovo = { responsavel: d.responsavel.trim(), parentesco: d.parentesco.trim(), telefone: d.telefone.trim(), endereco: d.endereco.trim(), cartao_sus: d.cartao_sus.replace(/\D/g, ''), cpf: privado.cpf || '', motivo_encaminhamento: d.motivo_encaminhamento.trim() };
      const clinicoNovo = pode.clinico() ? { necessidade_informada: d.necessidade_informada.trim(), fonte: d.fonte.trim(), observacoes: d.observacoes.trim() } : null;
      const novoId = await dados.salvarEstudante({ id, estudante: est, privado: privadoNovo, clinico: clinicoNovo, novo: !id });
      const local = { situacao: 'ativo', ...e, ...est, id: novoId };
      S.estudantes = [...S.estudantes.filter(x => x.id !== novoId), local];
      aviso(id ? 'Cadastro atualizado.' : 'Aluno cadastrado.');
      if (!id) irPara('#/aluno/' + novoId); else mudou();
    }
  });
  ativarContadores(form);
}

export function arquivarAluno(id) {
  const e = estudante(id);
  const reativar = e.situacao === 'arquivado';
  modal({
    titulo: reativar ? 'Reativar aluno' : 'Arquivar aluno',
    corpo: '<p>' + (reativar ? 'O aluno volta para a lista ativa e pode receber novos atendimentos.' : 'O aluno sai da lista ativa e não recebe novos agendamentos. <strong>Todo o prontuário é preservado.</strong>') + '</p>'
      + (reativar ? '' : area('motivo', 'Motivo', { obrig: true, max: 500, linhas: 2, dica: 'Ex.: transferido para outra rede, concluiu etapa' })),
    botao: reativar ? 'Reativar' : 'Arquivar',
    aoSalvar: async d => {
      const est = { situacao: reativar ? 'ativo' : 'arquivado', motivo_arquivamento: reativar ? '' : d.motivo.trim() };
      await dados.salvarEstudante({ id, estudante: est });
      Object.assign(e, est); aviso(reativar ? 'Aluno reativado.' : 'Aluno arquivado.'); mudou();
    }
  });
}

// ---------- registro de atendimento (card do prontuário) ----------
const DURACOES = [[20, '20 min'], [30, '30 min'], [40, '40 min'], [45, '45 min'], [50, '50 min'], [60, '1 hora'], [90, '1h30']];

/**
 * @param {object} o  estudanteId | agendamento | (atendimento + registro para retificar)
 */
export function formAtendimento({ estudanteId = '', agendamento = null, atendimento = null, registro = null } = {}) {
  if (!pode.registrar()) return aviso('Somente as especialistas registram atendimentos.', 'erro');
  if (!S.perfil.especialidade) return aviso('Sua conta não tem especialidade definida. Peça à administração.', 'erro');
  const ret = Boolean(atendimento);
  const alunoId = atendimento?.estudante_id || agendamento?.estudante_id || estudanteId;
  const quando = atendimento ? ms(atendimento.data) : agendamento ? ms(agendamento.inicio) : Date.now();
  const corpo = '<div class="grade">'
    + seletorAluno('estudante_id', alunoId)
    + '<div class="campo"><span>Especialidade</span><div class="aluno-fixo">' + esc(ESPECIALIDADES[S.perfil.especialidade]) + ' · ' + esc(S.perfil.nome) + '</div></div>'
    + opcoes('tipo', 'Tipo de atendimento', TIPOS_ATENDIMENTO, { valor: atendimento?.tipo || 'sessao', obrig: true })
    + campo('dia', 'Data', { tipo: 'date', valor: diaMunicipal(quando), obrig: true, extra: 'max="' + hoje() + '"' })
    + campo('hora', 'Horário', { tipo: 'time', valor: horaMunicipal(quando), obrig: true })
    + opcoes('duracao_min', 'Duração', DURACOES, { valor: atendimento?.duracao_min || agendamento?.duracao_min || 30 })
    + '</div>'
    + area('trabalhado', 'O que foi trabalhado', { valor: registro?.trabalhado, obrig: true, max: LIMITES.texto, linhas: 4, dica: 'Objetivos da sessão, atividades, recursos e estratégias' })
    + area('desenvolvido', 'O que foi desenvolvido / resposta do aluno', { valor: registro?.desenvolvido, max: LIMITES.texto, linhas: 4, dica: 'Desempenho, avanços, dificuldades, comportamento observado' })
    + area('orientacoes', 'Orientações e próximos passos', { valor: registro?.orientacoes, max: LIMITES.texto, linhas: 3, dica: 'Para a família, a escola e a equipe; encaminhamentos' })
    + '<div class="grade">' + opcoes('evolucao', 'Evolução observada', EVOLUCAO, { valor: atendimento?.evolucao || 'nao_avaliado', obrig: true }) + '</div>'
    + (ret ? area('motivo', 'Motivo da retificação', { obrig: true, max: 500, linhas: 2, dica: 'A versão anterior fica guardada no histórico' }) : '')
    + '<p class="nota">O registro fica visível para toda a equipe de especialistas no prontuário do aluno. Somente você pode retificá-lo.</p>';
  const form = modal({
    titulo: ret ? 'Retificar atendimento' : agendamento ? 'Registrar atendimento agendado' : 'Registrar atendimento',
    corpo, largo: true, botao: ret ? 'Salvar retificação' : 'Salvar no prontuário',
    aoSalvar: async d => {
      if (!d.estudante_id) throw Error('Selecione o aluno.');
      const e = estudante(d.estudante_id);
      const registroNovo = validarRegistro(d);
      const data = instante(d.dia, d.hora);
      if (!data || data.getTime() > Date.now() + 5 * 60000) throw Error('A data e hora não podem estar no futuro. Para atendimentos futuros, use Agendar.');
      const meta = { estudante_id: e.id, escola_id: e.escola_id, profissional_nome: S.perfil.nome, especialidade: S.perfil.especialidade, tipo: d.tipo, evolucao: d.evolucao, data, duracao_min: Number(d.duracao_min) };
      if (ret) await dados.retificarAtendimento(atendimento.id, meta, registroNovo, d.motivo.trim());
      else await dados.registrarAtendimento({ meta, registro: registroNovo, agendamentoId: agendamento?.id || '' });
      invalidarAtendimentos();
      aviso(ret ? 'Atendimento retificado.' : 'Atendimento salvo no prontuário.');
      if (!ret && !estudanteId && !agendamento) irPara('#/aluno/' + e.id); else mudou();
    }
  });
  ativarContadores(form); ativarSeletorAluno(form);
}

export function anularAtendimento(a) {
  modal({
    titulo: 'Anular registro',
    corpo: '<p>Use apenas para registro feito por engano (aluno errado, duplicado). O card continua no prontuário, riscado, com o motivo. <strong>Para corrigir o texto, use Retificar.</strong></p>'
      + area('motivo', 'Motivo da anulação', { obrig: true, max: 500, linhas: 2 }),
    botao: 'Anular registro',
    aoSalvar: async d => { await dados.anularAtendimento(a.id, d.motivo.trim()); invalidarAtendimentos(); aviso('Registro anulado.'); mudou(); }
  });
}

// ---------- agendamento ----------
export function formAgendar({ estudanteId = '', profissionalUid = '', dia = '' } = {}) {
  if (!pode.agendar()) return;
  const profs = especialistas();
  const fixo = S.perfil.perfil === 'especialista';
  const prof0 = fixo ? S.user.uid : profissionalUid || '';
  let diaInicial = dia || somarDias(hoje(), 1);
  const corpo = '<div class="grade">'
    + seletorAluno('estudante_id', estudanteId)
    + (fixo ? '<div class="campo"><span>Profissional</span><div class="aluno-fixo">' + esc(S.perfil.nome) + ' · ' + esc(ESPECIALIDADES[S.perfil.especialidade] || '') + '</div><input type="hidden" name="profissional_uid" value="' + esc(S.user.uid) + '"></div>'
      : opcoes('profissional_uid', 'Profissional', profs.map(u => [u.id, u.nome + ' — ' + (ESPECIALIDADES[u.especialidade] || '')]), { valor: prof0, obrig: true, vazio: 'Selecione' }))
    + campo('dia', 'Dia', { tipo: 'date', valor: diaInicial, obrig: true, extra: 'min="' + hoje() + '"' })
    + opcoes('duracao_min', 'Duração', [[30, '30 minutos'], [60, '1 hora']], { valor: 30 })
    + '</div><div class="campo largo"><span>Horários disponíveis <b class="obrig">*</b></span><div class="horarios" data-horarios><p class="nota">Selecione a profissional e o dia.</p></div></div>'
    + campo('observacao', 'Observação (opcional)', { largo: true, extra: 'maxlength="300"', dica: 'Ex.: trazer caderno; responsável deve acompanhar' });
  const form = modal({
    titulo: 'Agendar atendimento', corpo, largo: true, botao: 'Confirmar agendamento',
    aoSalvar: async d => {
      if (!d.estudante_id) throw Error('Selecione o aluno.');
      if (!d.horario) throw Error('Escolha um horário disponível.');
      const prof = S.usuarios.find(u => u.id === d.profissional_uid), e = estudante(d.estudante_id);
      const inicio = new Date(Number(d.horario)), duracao = Number(d.duracao_min);
      const ocupados = await dados.listarAgendamentos({ profissional: prof.id, de: instante(d.dia, '00:00'), ate: instante(somarDias(d.dia, 1), '00:00') });
      validarAgendamento({ inicio, duracao, slots: prof.slots || [], ocupados });
      await dados.agendar({ estudante_id: e.id, escola_id: e.escola_id, profissional_uid: prof.id, profissional_nome: prof.nome, especialidade: prof.especialidade, inicio, duracao_min: duracao, observacao: d.observacao.trim() });
      aviso('Agendado para ' + formatarDataHora(inicio) + '.'); mudou();
    }
  });
  const atualizar = async () => {
    const box = $('[data-horarios]', form), d = Object.fromEntries(new FormData(form));
    const prof = S.usuarios.find(u => u.id === d.profissional_uid);
    if (!prof || !d.dia) { box.innerHTML = '<p class="nota">Selecione a profissional e o dia.</p>'; return; }
    if (!(prof.slots || []).length) { box.innerHTML = '<p class="nota alerta">Esta profissional ainda não tem jornada cadastrada.</p>'; return; }
    box.innerHTML = '<p class="nota">Consultando agenda…</p>';
    try {
      const ocupados = await dados.listarAgendamentos({ profissional: prof.id, de: instante(d.dia, '00:00'), ate: instante(somarDias(d.dia, 1), '00:00') });
      const livres = horariosLivres({ dia: d.dia, slots: prof.slots, ocupados, duracao: Number(d.duracao_min) });
      const e = estudante(d.estudante_id);
      let algumOutro = false;
      box.innerHTML = livres.length ? livres.map(t => {
        const f = faixaDoHorario(prof.jornada, t), local = f?.escola_id ? escolaCurta(f.escola_id) : '';
        const outro = e && f?.escola_id && f.escola_id !== e.escola_id; if (outro) algumOutro = true;
        return '<label class="horario' + (outro ? ' outro-local' : '') + '" title="' + esc(local ? 'Local da jornada: ' + local : '') + '"><input type="radio" name="horario" value="' + t.getTime() + '" required><span>' + horaMunicipal(t) + '</span>' + (local ? '<small>' + esc(local) + '</small>' : '') + '</label>';
      }).join('') + (algumOutro ? '<p class="nota largo">Horários com borda tracejada estão na jornada de outra escola: confirme o local com a família.</p>' : '')
        : '<p class="nota alerta">Sem horários livres neste dia (fora da jornada ou já ocupados).</p>';
    } catch (err) { box.innerHTML = '<p class="nota alerta">Não foi possível consultar a agenda.</p>'; erro(err); }
  };
  ['profissional_uid', 'dia', 'duracao_min'].forEach(n => { const el = form.elements.namedItem(n); if (el) el.onchange = atualizar; });
  ativarSeletorAluno(form, atualizar);
  atualizar();
}

export function abrirAgendamento(ag) {
  const e = estudante(ag.estudante_id);
  const propria = S.perfil.perfil === 'especialista' && ag.profissional_uid === S.user.uid;
  const passou = ms(ag.inicio) <= Date.now();
  const podeCancelar = ag.status === 'agendado' && (propria || pode.gestao() || (S.perfil.perfil === 'direcao' && (S.perfil.escolas || []).includes(ag.escola_id)));
  const corpo = '<dl class="ficha-dados">'
    + '<div><dt>Aluno</dt><dd>' + esc(e?.nome || 'Aluno') + '</dd></div>'
    + '<div><dt>Escola</dt><dd>' + esc(nomeEscola(ag.escola_id)) + '</dd></div>'
    + '<div><dt>Data e horário</dt><dd>' + esc(formatarDataHora(ag.inicio)) + ' · ' + ag.duracao_min + ' min</dd></div>'
    + '<div><dt>Profissional</dt><dd>' + esc(ag.profissional_nome) + ' · ' + esc(ESPECIALIDADES[ag.especialidade]) + '</dd></div>'
    + '<div><dt>Situação</dt><dd><span class="selo s-' + esc(ag.status) + '">' + esc(STATUS_AGENDA[ag.status]) + '</span>' + (ag.motivo ? ' — ' + esc(ag.motivo) : '') + '</dd></div>'
    + (ag.observacao ? '<div><dt>Observação</dt><dd>' + esc(ag.observacao) + '</dd></div>' : '') + '</dl>'
    + '<div class="acoes-linha">'
    + (propria && ag.status === 'agendado' ? '<button type="button" class="btn" data-ag="registrar">Registrar atendimento</button>' : '')
    + ((propria || pode.gestao()) && ag.status === 'agendado' && passou ? '<button type="button" class="btn sec" data-ag="falta">Aluno faltou</button>' : '')
    + (podeCancelar ? '<button type="button" class="btn sec perigo" data-ag="cancelar">Cancelar agendamento</button>' : '')
    + (e ? '<a class="btn sec" href="#/aluno/' + esc(e.id) + '" data-fechar-link>Abrir prontuário</a>' : '')
    + '</div>';
  const form = modal({ titulo: 'Agendamento', corpo, somenteLeitura: true });
  $$('[data-fechar-link]', form).forEach(a => a.addEventListener('click', () => document.getElementById('modal')?.remove()));
  $$('[data-ag]', form).forEach(b => b.onclick = () => {
    const acao = b.dataset.ag;
    if (acao === 'registrar') return formAtendimento({ agendamento: ag });
    if (acao === 'cancelar') return modal({ titulo: 'Cancelar agendamento', corpo: '<p>O horário volta a ficar disponível. O cancelamento fica registrado.</p>' + area('motivo', 'Motivo', { obrig: true, max: 500, linhas: 2 }), botao: 'Cancelar agendamento', aoSalvar: async d => { await dados.cancelarAgendamento(ag, d.motivo.trim()); aviso('Agendamento cancelado.'); mudou(); } });
    if (acao === 'falta') return modal({ titulo: 'Registrar falta do aluno', corpo: area('motivo', 'Justificativa (se houver)', { max: 500, linhas: 2 }), botao: 'Registrar falta', aoSalvar: async d => { await dados.marcarFalta(ag, d.motivo.trim()); aviso('Falta registrada.'); mudou(); } });
  });
}

export { idade, formatarData };
