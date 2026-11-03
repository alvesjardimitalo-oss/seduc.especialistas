// Segurança (somente administração): quem acessou cada prontuário e cópia de segurança criptografada.
import * as dados from '../dados.js';
import { S, escolaCurta, estudante } from '../estado.js';
import { PERFIS, diaMunicipal, somarDias, instante, formatarDataHora, formatarData, normalizar, ms, csv } from '../dominio.js';
import { esc, vazio, aviso, erro, $ } from '../ui.js';
import { criptografar, abrir, validarSenha } from '../backup.js';

const ACOES = { prontuario: 'Abriu o prontuário', impressao: 'Imprimiu o prontuário', ficha_escola: 'Imprimiu a ficha para a escola', relatorio: 'Imprimiu documento (relatório/parecer)' };
const f = { de: '', ate: '', busca: '' };

export async function render(main, vigente) {
  const hoje = diaMunicipal(Date.now());
  f.de ||= somarDias(hoje, -7); f.ate ||= hoje;
  const acessos = await dados.listarAcessos({ de: instante(f.de, '00:00'), ate: instante(somarDias(f.ate, 1), '00:00') });
  if (!vigente()) return;
  const b = normalizar(f.busca);
  const lista = acessos.filter(a => !b || normalizar(a.nome).includes(b) || normalizar(estudante(a.estudante_id)?.nome).includes(b)).sort((x, y) => ms(y.em) - ms(x.em));
  const pessoas = new Set(lista.map(a => a.uid)).size, alunos = new Set(lista.map(a => a.estudante_id)).size;

  main.innerHTML = '<header class="pagina-topo"><div><h1>Segurança e LGPD</h1><p>Registro de quem abriu ou imprimiu prontuários e cópia de segurança dos dados.</p></div></header>'
    + '<section class="cartao"><header class="cartao-topo"><h2>Acessos aos prontuários</h2><button class="btn sec pequeno" id="csv-acessos">Planilha (CSV)</button></header>'
    + '<form class="filtros-linha" id="filtros"><label class="campo"><span>De</span><input type="date" name="de" value="' + esc(f.de) + '"></label><label class="campo"><span>Até</span><input type="date" name="ate" value="' + esc(f.ate) + '"></label>'
    + '<label class="campo busca-grande"><span>Pessoa ou aluno</span><input type="search" name="busca" value="' + esc(f.busca) + '" placeholder="Nome"></label></form>'
    + '<p class="nota">' + lista.length + ' acesso(s) · ' + pessoas + ' pessoa(s) · ' + alunos + ' aluno(s). Repetições do mesmo prontuário em 10 minutos contam uma vez.</p>'
    + (lista.length ? '<table class="tabela"><thead><tr><th>Quando</th><th>Quem</th><th>Cargo</th><th>Aluno</th><th>Instituição</th><th>Ação</th></tr></thead><tbody>'
      + lista.slice(0, 500).map(a => '<tr><td>' + esc(formatarDataHora(a.em)) + '</td><td>' + esc(a.nome) + '</td><td>' + esc(a.cargo || PERFIS[a.perfil] || a.perfil) + '</td><td><a href="#/aluno/' + esc(a.estudante_id) + '">' + esc(estudante(a.estudante_id)?.nome || a.estudante_id) + '</a></td><td>' + esc(a.escola_id ? escolaCurta(a.escola_id) : '—') + '</td><td>' + esc(ACOES[a.acao] || a.acao) + (a.acao !== 'prontuario' ? '<br><small class="nota">Registro ' + esc(a.id.slice(0, 10).toUpperCase()) + '</small>' : '') + '</td></tr>').join('')
      + '</tbody></table>' : vazio('Nenhum acesso no período.'))
    + '</section>'
    + '<section class="cartao"><h2>Cópia de segurança</h2>'
    + '<p>Baixa <strong>todos os dados</strong> do sistema num arquivo criptografado (AES-256). Sem a senha ninguém abre o arquivo — nem você: guarde a senha em local seguro, separado do arquivo.</p>'
    + '<form id="form-backup" class="grade"><label class="campo"><span>Senha da cópia (mín. 12 caracteres)</span><input type="password" name="senha" autocomplete="new-password" minlength="12" required></label>'
    + '<label class="campo"><span>Repita a senha</span><input type="password" name="senha2" autocomplete="new-password" required></label>'
    + '<div class="campo largo"><button class="btn" type="submit">Baixar cópia criptografada</button><small data-progresso class="nota"></small></div></form>'
    + '<details class="anteriores"><summary>Conferir uma cópia (abre no navegador, nada é enviado)</summary><form id="form-conferir" class="grade">'
    + '<label class="campo"><span>Arquivo da cópia</span><input type="file" name="arquivo" accept=".json,application/json" required></label>'
    + '<label class="campo"><span>Senha</span><input type="password" name="senha" autocomplete="off" required></label>'
    + '<div class="campo largo"><button class="btn sec" type="submit">Conferir</button></div><div class="largo" data-conferencia></div></form></details>'
    + '<p class="nota">Cópia automática semanal: o GitHub gera a mesma cópia criptografada todo domingo (veja docs/IMPLANTACAO.md, seção "Cópia de segurança automática").</p></section>';

  let t;
  $('#filtros', main).oninput = ev => { clearTimeout(t); t = setTimeout(() => { Object.assign(f, Object.fromEntries(new FormData(ev.currentTarget))); render(main, vigente); }, ev.target.name === 'busca' ? 300 : 0); };
  $('#csv-acessos', main).onclick = () => baixar(csv([['Quando', 'Quem', 'Cargo', 'Código do aluno', 'Instituição', 'Ação']].concat(lista.map(a => [formatarDataHora(a.em), a.nome, a.cargo || PERFIS[a.perfil] || a.perfil, a.estudante_id.slice(-6), a.escola_id ? escolaCurta(a.escola_id) : '', ACOES[a.acao] || a.acao]))), 'acessos_' + f.de + '_' + f.ate + '.csv', 'text/csv;charset=utf-8');

  $('#form-backup', main).onsubmit = async ev => {
    ev.preventDefault();
    const form = ev.currentTarget, prog = $('[data-progresso]', form), btn = form.querySelector('button');
    try {
      validarSenha(form.senha.value);
      if (form.senha.value !== form.senha2.value) throw Error('As senhas não conferem.');
      btn.disabled = true;
      const tudo = await dados.exportarTudo((i, n, nome) => { prog.textContent = 'Lendo ' + nome + ' (' + i + '/' + n + ')…'; });
      prog.textContent = 'Criptografando…';
      const contagem = Object.fromEntries(Object.entries(tudo).map(([k, v]) => [k, v.length]));
      const env = await criptografar(tudo, form.senha.value, { origem: 'navegador', gerado_por: S.perfil.nome, contagem });
      baixar(JSON.stringify(env), 'seduc-especialistas_copia_' + diaMunicipal(Date.now()) + '.json', 'application/json');
      prog.textContent = 'Cópia gerada: ' + Object.values(contagem).reduce((a, b) => a + b, 0) + ' registros.';
      form.reset(); aviso('Cópia de segurança baixada.');
    } catch (e) { erro(e); prog.textContent = ''; } finally { btn.disabled = false; }
  };
  $('#form-conferir', main).onsubmit = async ev => {
    ev.preventDefault();
    const form = ev.currentTarget, box = $('[data-conferencia]', form);
    try {
      const env = JSON.parse(await form.arquivo.files[0].text());
      const dadosAbertos = await abrir(env, form.senha.value);
      box.innerHTML = '<p class="alerta-caixa ok">Cópia íntegra, gerada em ' + esc(formatarDataHora(env.gerado_em)) + '.</p><table class="tabela"><tbody>'
        + Object.entries(dadosAbertos).map(([k, v]) => '<tr><td>' + esc(k) + '</td><td class="num">' + v.length + '</td></tr>').join('') + '</tbody></table>';
    } catch (e) { box.innerHTML = '<p class="alerta-caixa erro">' + esc(e.message) + '</p>'; }
  };
}

function baixar(conteudo, nome, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nome }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lista de acessos de um aluno (botão "Quem acessou" no prontuário, só administração). */
export async function quemAcessou(e) {
  const { modal } = await import('../ui.js');
  try {
    const lista = (await dados.listarAcessos({ estudanteId: e.id })).sort((a, b) => ms(b.em) - ms(a.em));
    modal({ titulo: 'Quem acessou — ' + e.nome, somenteLeitura: true, largo: true,
      corpo: lista.length ? '<table class="tabela"><thead><tr><th>Quando</th><th>Quem</th><th>Cargo</th><th>Ação</th></tr></thead><tbody>' + lista.slice(0, 300).map(a => '<tr><td>' + esc(formatarDataHora(a.em)) + '</td><td>' + esc(a.nome) + '</td><td>' + esc(a.cargo || PERFIS[a.perfil] || a.perfil) + '</td><td>' + esc(ACOES[a.acao] || a.acao) + '</td></tr>').join('') + '</tbody></table>' : vazio('Nenhum acesso registrado.', 'Os acessos passaram a ser registrados a partir desta versão do sistema.') });
  } catch (err) { erro(err); }
}
