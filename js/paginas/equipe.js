import * as dados from '../dados.js';
import { S, pode, escolaCurta } from '../estado.js';
import { ESPECIALIDADES, PERFIS, DIAS, prepararJornada, resumoJornada, formatarData } from '../dominio.js';
import { esc, iniciais, vazio, modal, campo, opcoes, aviso, erro, $, $$ } from '../ui.js';

export async function render(main, vigente) {
  const gerencia = pode.gerenciar();
  const [usuarios, convites] = await Promise.all([dados.listarUsuarios(), gerencia ? dados.listarConvites() : []]);
  if (!vigente()) return;
  S.usuarios = usuarios;
  const ord = (a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR');
  const pendentes = usuarios.filter(u => u.perfil === 'pendente' && !u.excluido).sort(ord);
  const esp = usuarios.filter(u => u.perfil === 'especialista').sort((a, b) => String(a.especialidade).localeCompare(b.especialidade) || ord(a, b));
  const outros = usuarios.filter(u => !['especialista', 'pendente'].includes(u.perfil)).sort(ord);

  let h = '<header class="pagina-topo"><div><h1>Equipe</h1><p>Especialistas, jornadas de trabalho e acessos.</p></div>'
    + (gerencia ? '<div class="acoes-linha"><button class="btn" id="convidar">+ Autorizar por e-mail</button></div>' : '') + '</header>';
  if (gerencia && pendentes.length) h += '<section class="cartao destaque"><h2>Aguardando liberação (' + pendentes.length + ')</h2><p class="nota">Pessoas que entraram com Google e ainda não têm acesso. Confira o e-mail antes de liberar.</p>' + pendentes.map(linha).join('') + '</section>';
  h += '<section class="cartao"><h2>Especialistas</h2>' + (esp.length ? esp.map(linha).join('') : vazio('Nenhuma especialista cadastrada.', gerencia ? 'Autorize o e-mail Google de cada profissional.' : '')) + '</section>';
  if (gerencia || S.perfil.perfil === 'secretaria') h += '<section class="cartao"><h2>Gestão e direções</h2>' + (outros.length ? outros.map(linha).join('') : vazio('Nenhuma conta.')) + '</section>';
  if (gerencia) h += '<section class="cartao"><h2>Autorizações por e-mail</h2><p class="nota">A pessoa entra com a conta Google deste e-mail e o acesso é liberado automaticamente.</p>'
    + (convites.length ? '<table class="tabela"><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th></th></tr></thead><tbody>' + convites.map(c => {
      const usado = usuarios.some(u => String(u.email).toLowerCase() === c.email);
      return '<tr><td>' + esc(c.nome) + '</td><td>' + esc(c.email) + '</td><td>' + esc(c.perfil === 'especialista' ? ESPECIALIDADES[c.especialidade] : PERFIS[c.perfil]) + '</td><td>' + (usado ? 'Já acessou' : 'Aguardando primeiro acesso') + '</td><td><button class="link perigo" data-remover-convite="' + esc(c.email) + '">Remover</button></td></tr>';
    }).join('') + '</tbody></table>' : vazio('Nenhuma autorização pendente.')) + '</section>';
  main.innerHTML = h;

  $$('[data-editar]', main).forEach(b => b.onclick = () => editar(usuarios.find(u => u.id === b.dataset.editar)));
  $('#convidar', main)?.addEventListener('click', convidar);
  $$('[data-remover-convite]', main).forEach(b => b.onclick = async () => {
    if (!confirm('Remover a autorização de ' + b.dataset.removerConvite + '?')) return;
    try { await dados.removerConvite(b.dataset.removerConvite); render(main, vigente); } catch (e) { erro(e); }
  });

  function linha(u) {
    const papel = u.perfil === 'especialista' ? ESPECIALIDADES[u.especialidade] || 'Especialidade não definida' : PERFIS[u.perfil] || u.perfil;
    const situacao = u.excluido || (!u.ativo && u.perfil !== 'pendente') ? '<span class="selo s-cancelado">Desativado</span>' : '';
    return '<div class="pessoa"><span class="avatar">' + esc(iniciais(u.nome)) + '</span><div class="pessoa-info"><strong>' + esc(u.nome) + ' ' + situacao + '</strong>'
      + '<small>' + esc(papel) + (u.registro_profissional ? ' · ' + esc(u.registro_profissional) : '') + (gerencia ? ' · ' + esc(u.email) : '') + (u.perfil === 'direcao' ? ' · ' + esc((u.escolas || []).map(escolaCurta).join(', ')) : '') + '</small>'
      + (u.perfil === 'especialista' ? '<span class="jornada-txt">' + esc(resumoJornada(u.jornada, escolaCurta)) + '</span>' : '') + '</div>'
      + (gerencia && (u.perfil !== 'superadmin' || pode.admin()) ? '<button class="btn sec pequeno" data-editar="' + esc(u.id) + '">' + (u.perfil === 'pendente' ? 'Liberar acesso' : 'Editar') + '</button>' : '') + '</div>';
  }

  function camposAcesso(u = {}) {
    const perfis = [['especialista', 'Especialista'], ['direcao', 'Direção escolar'], ...(pode.admin() ? [['secretaria', 'Secretaria de Educação'], ['superadmin', 'Administração']] : u.perfil === 'secretaria' ? [['secretaria', 'Secretaria de Educação']] : [])];
    return '<div class="grade">' + opcoes('perfil', 'Perfil de acesso', perfis, { valor: u.perfil === 'pendente' ? 'especialista' : u.perfil, obrig: true, extra: 'data-perfil' })
      + opcoes('especialidade', 'Especialidade', ESPECIALIDADES, { valor: u.especialidade || '', vazio: 'Selecione', extra: 'data-so="especialista"' })
      + '</div><div class="campo largo" data-so="direcao"><span>Escolas da direção</span><div class="checks">' + S.escolas.map(e => '<label class="check"><input type="checkbox" name="escolas" data-lista value="' + esc(e.id) + '"' + ((u.escolas || []).includes(e.id) ? ' checked' : '') + '> ' + esc(escolaCurta(e.id)) + '</label>').join('') + '</div></div>';
  }
  function ligarPerfil(form) {
    const atualizar = () => { const p = form.perfil.value; $$('[data-so]', form).forEach(el => { const ok = el.dataset.so === p; (el.closest('label.campo') || el).hidden = !ok; if (el.tagName === 'SELECT') el.required = ok; }); };
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
        + campo('telefone', 'Telefone', { valor: u.telefone, extra: 'maxlength="40"' }) + '</div>'
        + camposAcesso(u)
        + '<fieldset data-so="especialista"><legend>Jornada semanal</legend><p class="nota">Dias e horários em que a profissional atende. Só é possível agendar dentro destas faixas. O local é informativo (onde ela está naquele período).</p><div id="jornada">' + ((u.jornada || []).length ? u.jornada.map(linhaJ).join('') : '') + '</div><button type="button" class="btn sec pequeno" id="mais-faixa">+ Adicionar faixa</button></fieldset>'
        + '<div class="grade">' + (pode.admin() && u.id !== S.user.uid ? '<label class="check"><input type="checkbox" name="gerenciar"' + (u.gerenciar ? ' checked' : '') + '> Pode gerenciar equipe, escolas e acessos (Secretaria)</label>' : '')
        + (u.id !== S.user.uid ? '<label class="check"><input type="checkbox" name="ativo"' + (u.ativo !== false || u.perfil === 'pendente' ? ' checked' : '') + '> Acesso ativo</label>' : '') + '</div>',
      botao: u.perfil === 'pendente' ? 'Liberar acesso' : 'Salvar',
      aoSalvar: async (d, f) => {
        const faixas = $$('.jornada-linha', f).map(l => ({ dia: l.querySelector('[name=j_dia]').value, inicio: l.querySelector('[name=j_ini]').value, fim: l.querySelector('[name=j_fim]').value, escola_id: l.querySelector('[name=j_local]').value }));
        const novo = { nome: d.nome.trim(), perfil: d.perfil, registro_profissional: d.registro_profissional.trim(), telefone: d.telefone.trim(),
          ativo: u.id === S.user.uid ? true : Boolean(d.ativo), excluido: false, escolas: d.perfil === 'direcao' ? (d.escolas || []) : [], especialidade: d.perfil === 'especialista' ? d.especialidade : '' };
        if (pode.admin() && u.id !== S.user.uid) novo.gerenciar = d.perfil === 'secretaria' && Boolean(d.gerenciar);
        if (d.perfil === 'especialista') {
          if (!d.especialidade) throw Error('Selecione a especialidade.');
          Object.assign(novo, prepararJornada(faixas));
        } else Object.assign(novo, { jornada: [], slots: [] });
        if (d.perfil === 'direcao' && !novo.escolas.length) throw Error('Selecione a(s) escola(s) da direção.');
        await dados.salvarUsuario(u.id, novo);
        aviso('Conta atualizada.'); render(main, vigente);
      }
    });
    ligarPerfil(form);
    const box = $('#jornada', form);
    $('#mais-faixa', form).onclick = () => { box.insertAdjacentHTML('beforeend', linhaJ()); ligarRemover(); };
    const ligarRemover = () => $$('[data-tirar]', box).forEach(b => b.onclick = () => b.parentElement.remove());
    ligarRemover();
  }

  function convidar() {
    const form = modal({
      titulo: 'Autorizar acesso por e-mail', largo: true, botao: 'Autorizar',
      corpo: '<p class="nota">Use o e-mail da conta Google que a pessoa usará para entrar. Nenhuma senha é criada ou enviada.</p><div class="grade">'
        + campo('nome', 'Nome completo', { obrig: true, extra: 'maxlength="180"' }) + campo('email', 'E-mail Google', { tipo: 'email', obrig: true, extra: 'maxlength="200"' }) + '</div>' + camposAcesso({ perfil: 'especialista' }),
      aoSalvar: async d => {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) throw Error('E-mail inválido.');
        if (d.perfil === 'especialista' && !d.especialidade) throw Error('Selecione a especialidade.');
        if (d.perfil === 'direcao' && !(d.escolas || []).length) throw Error('Selecione a(s) escola(s).');
        if (d.perfil === 'superadmin') throw Error('Administradores são definidos apenas na conta já existente.');
        await dados.salvarConvite({ email: d.email, nome: d.nome.trim(), perfil: d.perfil, especialidade: d.perfil === 'especialista' ? d.especialidade : '', escolas: d.perfil === 'direcao' ? d.escolas : [] });
        aviso('Autorização registrada. Peça para a pessoa entrar com o Google.'); render(main, vigente);
      }
    });
    ligarPerfil(form);
  }
}
