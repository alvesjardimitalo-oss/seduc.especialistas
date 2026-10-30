import * as dados from '../dados.js';
import { S, pode, escolaCurta } from '../estado.js';
import { ESPECIALIDADES, PERFIS, DIAS, prepararJornada, resumoJornada, formatarData } from '../dominio.js';
import { esc, iniciais, vazio, modal, campo, area, opcoes, aviso, erro, $, $$ } from '../ui.js';

let mostrarExcluidos = false;

export async function render(main, vigente) {
  const gerencia = pode.gerenciar();
  const [usuarios, convites] = await Promise.all([dados.listarUsuarios(), gerencia ? dados.listarConvites() : []]);
  if (!vigente()) return;
  S.usuarios = usuarios;
  const ord = (a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR');
  const ativos = usuarios.filter(u => !u.excluido);
  const excluidos = usuarios.filter(u => u.excluido).sort(ord);
  const pendentes = ativos.filter(u => u.perfil === 'pendente').sort(ord);
  const esp = ativos.filter(u => u.perfil === 'especialista').sort((a, b) => String(a.especialidade).localeCompare(b.especialidade) || ord(a, b));
  const outros = ativos.filter(u => !['especialista', 'pendente'].includes(u.perfil)).sort(ord);

  let h = '<header class="pagina-topo"><div><h1>Equipe</h1><p>Especialistas, jornadas de trabalho e acessos.</p></div>'
    + (gerencia ? '<div class="acoes-linha"><button class="btn" id="convidar">+ Novo acesso</button></div>' : '') + '</header>';
  if (gerencia && pendentes.length) h += '<section class="cartao destaque"><h2>Aguardando liberação (' + pendentes.length + ')</h2><p class="nota">Pessoas que entraram com Google e ainda não têm acesso. Confira o e-mail antes de liberar.</p>' + pendentes.map(linha).join('') + '</section>';
  h += '<section class="cartao"><h2>Especialistas</h2>' + (esp.length ? esp.map(linha).join('') : vazio('Nenhuma especialista cadastrada.', gerencia ? 'Autorize o e-mail Google de cada profissional.' : '')) + '</section>';
  if (gerencia || S.perfil.perfil === 'secretaria') h += '<section class="cartao"><h2>Gestão e direções</h2>' + (outros.length ? outros.map(linha).join('') : vazio('Nenhuma conta.')) + '</section>';
  if (gerencia) h += '<section class="cartao"><h2>Autorizações por e-mail</h2><p class="nota">A pessoa entra com a conta Google deste e-mail e o acesso é liberado automaticamente.</p>'
    + (convites.length ? '<table class="tabela"><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th></th></tr></thead><tbody>' + convites.map(c => {
      const usado = usuarios.some(u => String(u.email).toLowerCase() === c.email);
      return '<tr><td>' + esc(c.nome) + '</td><td>' + esc(c.email) + '</td><td>' + esc(c.perfil === 'especialista' ? ESPECIALIDADES[c.especialidade] : PERFIS[c.perfil]) + '</td><td>' + (usado ? 'Já acessou' : 'Aguardando primeiro acesso') + '</td><td><button class="link perigo" data-remover-convite="' + esc(c.email) + '">Remover</button></td></tr>';
    }).join('') + '</tbody></table>' : vazio('Nenhuma autorização pendente.')) + '</section>';
  if (gerencia && excluidos.length) h += '<section class="cartao"><header class="cartao-topo"><h2>Acessos excluídos (' + excluidos.length + ')</h2><button class="link" id="ver-excluidos">' + (mostrarExcluidos ? 'Ocultar' : 'Mostrar') + '</button></header>'
    + '<p class="nota">Contas bloqueadas. Os atendimentos registrados por elas continuam no prontuário com a autoria original.</p>'
    + (mostrarExcluidos ? excluidos.map(linha).join('') : '') + '</section>';
  main.innerHTML = h;

  $$('[data-editar]', main).forEach(b => b.onclick = () => editar(usuarios.find(u => u.id === b.dataset.editar)));
  $$('[data-excluir]', main).forEach(b => b.onclick = () => excluir(usuarios.find(u => u.id === b.dataset.excluir)));
  $$('[data-restaurar]', main).forEach(b => b.onclick = async () => {
    const u = usuarios.find(x => x.id === b.dataset.restaurar); b.disabled = true;
    try { await dados.restaurarAcesso(u); aviso('Acesso de ' + u.nome + ' restaurado.'); render(main, vigente); } catch (e) { erro(e); b.disabled = false; }
  });
  $$('[data-recusar]', main).forEach(b => b.onclick = () => recusar(usuarios.find(u => u.id === b.dataset.recusar)));
  $('#ver-excluidos', main)?.addEventListener('click', () => { mostrarExcluidos = !mostrarExcluidos; render(main, vigente); });
  $('#convidar', main)?.addEventListener('click', convidar);
  $$('[data-remover-convite]', main).forEach(b => b.onclick = async () => {
    if (!confirm('Remover a autorização de ' + b.dataset.removerConvite + '?')) return;
    try { await dados.removerConvite(b.dataset.removerConvite); render(main, vigente); } catch (e) { erro(e); }
  });

  function linha(u) {
    const papel = u.perfil === 'especialista' ? ESPECIALIDADES[u.especialidade] || 'Especialidade não definida' : PERFIS[u.perfil] || u.perfil;
    const situacao = u.excluido ? '<span class="selo s-cancelado">Excluído</span>' : !u.ativo && u.perfil !== 'pendente' ? '<span class="selo s-cancelado">Desativado</span>' : '';
    const protegido = u.id === S.user.uid || (u.perfil === 'superadmin' && !pode.admin());
    let botoes = '';
    if (gerencia && !protegido) {
      if (u.excluido) botoes = '<button class="btn sec pequeno" data-restaurar="' + esc(u.id) + '">Restaurar acesso</button>';
      else if (u.perfil === 'pendente') botoes = '<button class="btn pequeno" data-editar="' + esc(u.id) + '">Liberar acesso</button><button class="btn sec pequeno perigo" data-recusar="' + esc(u.id) + '">Recusar</button>';
      else botoes = '<button class="btn sec pequeno" data-editar="' + esc(u.id) + '">Editar</button><button class="btn sec pequeno perigo" data-excluir="' + esc(u.id) + '">Excluir acesso</button>';
    } else if (gerencia && u.id === S.user.uid) botoes = '<button class="btn sec pequeno" data-editar="' + esc(u.id) + '">Editar</button>';
    return '<div class="pessoa"><span class="avatar">' + esc(iniciais(u.nome)) + '</span><div class="pessoa-info"><strong>' + esc(u.nome) + ' ' + situacao + '</strong>'
      + '<small>' + esc(papel) + (u.registro_profissional ? ' · ' + esc(u.registro_profissional) : '') + (gerencia ? ' · ' + esc(u.email) : '') + (u.perfil === 'direcao' ? ' · ' + esc((u.escolas || []).map(escolaCurta).join(', ')) : '') + '</small>'
      + (u.perfil === 'especialista' && !u.excluido ? '<span class="nota">Atende: ' + esc((u.escolas || []).length ? u.escolas.map(escolaCurta).join(', ') : 'todas as instituições') + '</span><span class="jornada-txt">' + esc(resumoJornada(u.jornada, escolaCurta)) + '</span>' : '')
      + (u.excluido ? '<span class="nota">Excluído' + (u.excluido_em ? ' em ' + esc(formatarData(u.excluido_em)) : '') + (u.motivo_exclusao ? ': ' + esc(u.motivo_exclusao) : '') + '</span>' : '') + '</div>'
      + '<div class="acoes-linha">' + botoes + '</div></div>';
  }

  function camposAcesso(u = {}) {
    const perfis = [['especialista', 'Especialista'], ['direcao', 'Direção escolar'], ...(pode.admin() ? [['secretaria', 'Secretaria de Educação'], ['superadmin', 'Administração']] : u.perfil === 'secretaria' ? [['secretaria', 'Secretaria de Educação']] : [])];
    return '<div class="grade">' + opcoes('perfil', 'Perfil de acesso', perfis, { valor: u.perfil === 'pendente' ? 'especialista' : u.perfil, obrig: true, extra: 'data-perfil' })
      + opcoes('especialidade', 'Especialidade', ESPECIALIDADES, { valor: u.especialidade || '', vazio: 'Selecione', extra: 'data-so="especialista"' })
      + '</div><div class="campo largo" data-so="direcao especialista"><span>Instituições que atende <small>(especialista: deixe em branco se atende todas)</small></span><div class="checks">' + S.escolas.map(e => '<label class="check"><input type="checkbox" name="escolas" data-lista value="' + esc(e.id) + '"' + ((u.escolas || []).includes(e.id) ? ' checked' : '') + '> ' + esc(escolaCurta(e.id)) + '</label>').join('') + '</div></div>';
  }
  function ligarPerfil(form) {
    const atualizar = () => { const p = form.perfil.value; $$('[data-so]', form).forEach(el => { const ok = el.dataset.so.split(' ').includes(p); (el.closest('label.campo') || el).hidden = !ok; if (el.tagName === 'SELECT') el.required = ok; }); };
    form.perfil.onchange = atualizar; atualizar();
  }

  function editar(u) {
    const linhaJ = (f = {}) => '<div class="jornada-linha">' + '<select name="j_dia" aria-label="Dia">' + DIAS.map((d, i) => '<option value="' + i + '"' + (Number(f.dia ?? 1) === i ? ' selected' : '') + '>' + d + '</option>').join('') + '</select>'
      + '<input type="time" name="j_ini" step="1800" value="' + esc(f.inicio || '08:00') + '" aria-label="Início"><span>às</span><input type="time" name="j_fim" step="1800" value="' + esc(f.fim || '11:00') + '" aria-label="Fim">'
      + '<select name="j_local" aria-label="Local"><option value="">Local a combinar</option>' + S.escolas.map(e => '<option value="' + esc(e.id) + '"' + (f.escola_id === e.id ? ' selected' : '') + '>' + esc(escolaCurta(e.id)) + '</option>').join('') + '</select>'
      + '<button type="button" class="icone-btn" data-tirar aria-label="Remover faixa">✕</button></div>';
    const form = modal({
      titulo: (u.perfil === 'pendente' ? 'Liberar acesso — ' : 'Editar — ') + u.nome, largo: true,
      corpo: '<p class="nota">' + esc(u.email) + '</p><div class="grade">' + campo('nome', 'Nome completo', { valor: u.nome, obrig: true, extra: 'maxlength="180"' })
        + campo('registro_profissional', 'Registro profissional', { valor: u.registro_profissional, extra: 'maxlength="60"', dica: 'CRFa, CRP ou ABPp' })
        + campo('telefone', 'Telefone', { valor: u.telefone, extra: 'maxlength="40"' })
        + campo('endereco', 'Endereço', { valor: u.endereco, largo: true, extra: 'maxlength="300"' }) + '</div>'
        + camposAcesso(u)
        + '<fieldset data-so="especialista"><legend>Jornada semanal</legend><p class="nota">Dias e horários em que a profissional atende. Só é possível agendar dentro destas faixas. O local é informativo (onde ela está naquele período).</p><div id="jornada">' + ((u.jornada || []).length ? u.jornada.map(linhaJ).join('') : '') + '</div><button type="button" class="btn sec pequeno" id="mais-faixa">+ Adicionar faixa</button></fieldset>'
        + '<div class="grade">' + (pode.admin() && u.id !== S.user.uid ? '<label class="check"><input type="checkbox" name="gerenciar"' + (u.gerenciar ? ' checked' : '') + '> Pode gerenciar equipe, escolas e acessos (Secretaria)</label>' : '')
        + (u.id !== S.user.uid ? '<label class="check"><input type="checkbox" name="ativo"' + (u.ativo !== false || u.perfil === 'pendente' ? ' checked' : '') + '> Acesso ativo</label>' : '') + '</div>',
      botao: u.perfil === 'pendente' ? 'Liberar acesso' : 'Salvar',
      aoSalvar: async (d, f) => {
        const faixas = $$('.jornada-linha', f).map(l => ({ dia: l.querySelector('[name=j_dia]').value, inicio: l.querySelector('[name=j_ini]').value, fim: l.querySelector('[name=j_fim]').value, escola_id: l.querySelector('[name=j_local]').value }));
        const novo = { nome: d.nome.trim(), perfil: d.perfil, registro_profissional: d.registro_profissional.trim(), telefone: d.telefone.trim(), endereco: d.endereco.trim(),
          ativo: u.id === S.user.uid ? true : Boolean(d.ativo), excluido: false, escolas: ['direcao', 'especialista'].includes(d.perfil) ? (d.escolas || []) : [], especialidade: d.perfil === 'especialista' ? d.especialidade : '' };
        if (pode.admin() && u.id !== S.user.uid) novo.gerenciar = d.perfil === 'secretaria' && Boolean(d.gerenciar);
        if (d.perfil === 'especialista') {
          if (!d.especialidade) throw Error('Selecione a especialidade.');
          Object.assign(novo, prepararJornada(faixas));
        } else Object.assign(novo, { jornada: [], slots: [] });
        if (d.perfil === 'direcao' && !novo.escolas.length) throw Error('Selecione a(s) escola(s) da direção.');
        await dados.salvarUsuario(u.id, novo, u);
        aviso('Conta atualizada.'); render(main, vigente);
      }
    });
    ligarPerfil(form);
    const box = $('#jornada', form);
    $('#mais-faixa', form).onclick = () => { box.insertAdjacentHTML('beforeend', linhaJ()); ligarRemover(); };
    const ligarRemover = () => $$('[data-tirar]', box).forEach(b => b.onclick = () => b.parentElement.remove());
    ligarRemover();
  }

  async function excluir(u) {
    let futuros = [];
    if (u.perfil === 'especialista') {
      try { futuros = (await dados.listarAgendamentos({ profissional: u.id, de: new Date(), ate: new Date(Date.now() + 730 * 864e5) })).filter(a => a.status === 'agendado'); } catch (e) { erro(e); }
    }
    modal({
      titulo: 'Excluir acesso — ' + u.nome, botao: 'Excluir acesso',
      corpo: '<p>A conta deixa de entrar no sistema imediatamente. <strong>Os atendimentos, relatórios e o histórico registrados por ela são preservados</strong> com a autoria original, como exige a guarda do prontuário. O acesso pode ser restaurado depois.</p>'
        + (futuros.length ? '<div class="alerta-caixa aviso">Esta profissional tem <strong>' + futuros.length + ' agendamento(s) futuro(s)</strong>.</div><label class="check"><input type="checkbox" name="cancelar" checked> Cancelar esses agendamentos e liberar os horários</label>' : '')
        + area('motivo', 'Motivo', { obrig: true, max: 500, linhas: 2, dica: 'Ex.: fim do contrato; licença; conta de teste' }),
      aoSalvar: async d => {
        const n = await dados.excluirAcesso(u, d.motivo.trim(), Boolean(d.cancelar));
        aviso('Acesso excluído.' + (n ? ' ' + n + ' agendamento(s) cancelado(s).' : '')); render(main, vigente);
      }
    });
  }

  function recusar(u) {
    modal({
      titulo: 'Recusar solicitação', botao: 'Recusar e apagar',
      corpo: '<p>A solicitação de <strong>' + esc(u.nome) + '</strong> (' + esc(u.email) + ') será apagada. Esta conta nunca teve acesso nem registros. Se a pessoa entrar de novo com o Google, aparecerá outra vez como pendente.</p>',
      aoSalvar: async () => { await dados.apagarSolicitacao(u.id); aviso('Solicitação recusada.'); render(main, vigente); }
    });
  }

  function convidar() {
    const form = modal({
      titulo: 'Novo acesso', largo: true, botao: 'Criar acesso',
      corpo: '<div class="grade">' + campo('nome', 'Nome completo', { obrig: true, extra: 'maxlength="180"' }) + campo('email', 'E-mail', { tipo: 'email', obrig: true, extra: 'maxlength="200"' }) + '</div>'
        + '<fieldset><legend>Como a pessoa vai entrar</legend><label class="check"><input type="radio" name="modo" value="senha" checked> <span><strong>E-mail e senha</strong> — o sistema cria o login e envia ao e-mail um link para a pessoa definir a própria senha.</span></label>'
        + '<label class="check"><input type="radio" name="modo" value="google"> <span><strong>Conta Google</strong> — a pessoa entra com o Google deste e-mail e o acesso é liberado automaticamente.</span></label></fieldset>'
        + camposAcesso({ perfil: 'especialista' }),
      aoSalvar: async d => {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) throw Error('E-mail inválido.');
        if (d.perfil === 'especialista' && !d.especialidade) throw Error('Selecione a especialidade.');
        if (d.perfil === 'direcao' && !(d.escolas || []).length) throw Error('Selecione a(s) escola(s).');
        if (d.perfil === 'superadmin') throw Error('Administradores são definidos apenas na conta já existente.');
        const perfil = { nome: d.nome.trim(), perfil: d.perfil, especialidade: d.perfil === 'especialista' ? d.especialidade : '', escolas: ['direcao', 'especialista'].includes(d.perfil) ? (d.escolas || []) : [] };
        if (d.modo === 'senha') {
          await dados.criarContaComSenha(d.email, { ...perfil, ...(d.perfil === 'especialista' ? { jornada: [], slots: [] } : {}) });
          aviso('Acesso criado. ' + d.email.trim() + ' vai receber um e-mail para definir a senha. Lembre de cadastrar a jornada.');
        } else {
          await dados.salvarConvite({ email: d.email, ...perfil });
          aviso('Autorização registrada. Peça para a pessoa entrar com o Google.');
        }
        render(main, vigente);
      }
    });
    ligarPerfil(form);
  }
}
