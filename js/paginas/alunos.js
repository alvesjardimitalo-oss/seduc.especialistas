import * as dados from '../dados.js';
import { S, pode, escolaCurta, garantirAtendimentos, escolasVisiveis, carregarBase } from '../estado.js';
import { formAluno, irPara } from '../formularios.js';
import { ESPECIALIDADES, filtrarEstudantes, idade, formatarData, conferirImportacaoAlunos, resolverEscolasImportacao } from '../dominio.js';
import { esc, iniciais, vazio, modal, aviso, erro, $ } from '../ui.js';

const ABREV = { fonoaudiologia: 'Fono', neuropsicologia: 'Neuropsico', psicopedagogia: 'Psicopedagogia' };
export function chipsAcompanhamento(sit) {
  if (!sit) return '<span class="chip aguardando">Aguardando 1º atendimento</span>';
  return sit.especialidades.map(e => '<span class="chip esp-' + e + '">' + ABREV[e] + '</span>').join('')
    + sit.altas.map(e => '<span class="chip alta" title="Alta em ' + esc(ESPECIALIDADES[e]) + '">Alta ' + ABREV[e] + '</span>').join('');
}

export async function render(main, vigente) {
  await garantirAtendimentos();
  if (!vigente()) return;
  const f = S.filtrosAlunos;
  // Ao trocar a instituição no topo, a lista passa a mostrar os alunos dela.
  if (f.instAplicada !== S.instituicao) { f.escola = S.instituicao; f.instAplicada = S.instituicao; }
  const lista = filtrarEstudantes(S.estudantes, f, S.acompanhamento);
  const escolas = escolasVisiveis();
  main.innerHTML = '<header class="pagina-topo"><div><h1>Alunos</h1><p>' + S.estudantes.filter(e => (e.situacao || 'ativo') === 'ativo').length + ' alunos ativos' + (S.perfil.perfil === 'direcao' ? ' na(s) sua(s) escola(s)' : ' na rede') + '</p></div>'
    + '<div class="acoes-linha">' + (pode.cadastrarAluno() ? '<button class="btn" id="novo">+ Cadastrar aluno</button>' : '') + (pode.admin() ? '<button class="btn sec" id="importar">Importar planilha (JSON)</button>' : '') + '</div></header>'
    + '<form class="filtros cartao" id="filtros"><label class="campo"><span>Buscar</span><input type="search" name="busca" value="' + esc(f.busca) + '" placeholder="Nome do aluno"></label>'
    + '<label class="campo"><span>Escola</span><select name="escola"><option value="">Todas</option>' + escolas.map(e => '<option value="' + esc(e.id) + '"' + (f.escola === e.id ? ' selected' : '') + '>' + esc(escolaCurta(e.id)) + '</option>').join('') + '</select></label>'
    + '<label class="campo"><span>Em acompanhamento</span><select name="especialidade"><option value="">Qualquer</option>' + Object.entries(ESPECIALIDADES).map(([k, v]) => '<option value="' + k + '"' + (f.especialidade === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>'
    + '<label class="campo"><span>Situação</span><select name="situacao"><option value="ativo"' + (f.situacao === 'ativo' ? ' selected' : '') + '>Ativos</option><option value="arquivado"' + (f.situacao === 'arquivado' ? ' selected' : '') + '>Arquivados</option><option value=""' + (!f.situacao ? ' selected' : '') + '>Todos</option></select></label></form>'
    + '<p class="nota" role="status">' + lista.length + ' aluno(s) encontrado(s)</p>'
    + (lista.length ? '<div class="lista-alunos">' + lista.map(e => {
      const sit = S.acompanhamento.get(e.id), anos = idade(e.nascimento);
      return '<a class="aluno-item" href="#/aluno/' + esc(e.id) + '"><span class="avatar">' + esc(iniciais(e.nome)) + '</span>'
        + '<span class="aluno-nome"><strong>' + esc(e.nome) + '</strong><small>' + esc(escolaCurta(e.escola_id)) + (e.turma ? ' · ' + esc(e.turma) : '') + (anos != null ? ' · ' + anos + ' anos' : '') + (e.situacao === 'arquivado' ? ' · arquivado' : '') + '</small></span>'
        + '<span class="aluno-chips">' + chipsAcompanhamento(sit) + '</span>'
        + '<span class="aluno-ultimo">' + (sit?.ultimo ? 'Último: ' + esc(formatarData(sit.ultimo.data)) : '') + '</span></a>';
    }).join('') + '</div>' : vazio('Nenhum aluno encontrado.', 'Revise os filtros ou cadastre o aluno.'));

  const form = $('#filtros', main);
  let t;
  form.oninput = () => { clearTimeout(t); t = setTimeout(() => { Object.assign(S.filtrosAlunos, Object.fromEntries(new FormData(form))); const pos = form.busca.selectionStart; render(main, vigente).then(() => { const b = $('#filtros [name=busca]', main); b.focus(); b.setSelectionRange(pos, pos); }); }, 200); };
  form.onsubmit = e => e.preventDefault();
  $('#novo', main)?.addEventListener('click', () => formAluno());
  $('#importar', main)?.addEventListener('click', importar);
}

function importar() {
  const form = modal({
    titulo: 'Importar alunos da planilha 2026',
    corpo: '<p>Selecione o arquivo privado <code>seduc_alunos_especiais_2026_importacao_privada.json</code>. Ele <strong>não</strong> deve ser enviado ao GitHub. Alunos já cadastrados não são duplicados: só os campos vazios são completados, sem apagar o que a equipe editou. A importação pode ser repetida com segurança.</p><label class="campo largo"><span>Arquivo JSON</span><input type="file" name="arquivo" accept="application/json,.json" required></label><div data-previa></div>',
    botao: 'Importar',
    aoSalvar: async (_, f) => {
      const arq = f.arquivo.files[0]; if (!arq) throw Error('Selecione o arquivo.');
      const { registros, faltando } = resolverEscolasImportacao(conferirImportacaoAlunos(JSON.parse(await arq.text())), S.escolas);
      if (faltando.length) throw Error('Escola(s) não cadastrada(s): ' + faltando.join(', ') + '. Vá em Escolas → "Adicionar as escolas da rede" e importe de novo.');
      const r = await dados.importarEstudantes(registros, n => { $('[type=submit]', f).textContent = 'Importando ' + n + '/' + registros.length; });
      await carregarBase(); aviso(r.criados + ' aluno(s) novo(s); ' + r.completados + ' completado(s) com dados que faltavam; ' + r.iguais + ' sem alteração.');
      irPara('#/alunos');
    }
  });
  form.arquivo.onchange = async () => {
    const box = form.querySelector('[data-previa]');
    try {
      const { registros, faltando } = resolverEscolasImportacao(conferirImportacaoAlunos(JSON.parse(await form.arquivo.files[0].text())), S.escolas);
      const porEscola = {}; registros.forEach(r => { porEscola[r.estudante.escola_id] = (porEscola[r.estudante.escola_id] || 0) + 1; });
      box.innerHTML = '<p class="nota">' + registros.length + ' alunos no arquivo:</p><ul>' + Object.entries(porEscola).map(([k, n]) => '<li>' + (faltando.includes(k) ? '<strong class="alerta-texto">' + esc(k) + ' — escola não cadastrada</strong>' : esc(escolaCurta(k))) + ': ' + n + '</li>').join('') + '</ul>'
        + (faltando.length ? '<p class="alerta-caixa aviso">Cadastre antes a(s) escola(s) em destaque: vá em <strong>Escolas → Adicionar as escolas da rede</strong> e volte aqui.</p>' : '');
      const enviar = form.querySelector('[type=submit]'); if (enviar) enviar.disabled = faltando.length > 0;
    } catch (e) { box.innerHTML = '<p class="nota alerta">' + esc(e.message) + '</p>'; erro(e); }
  };
}
