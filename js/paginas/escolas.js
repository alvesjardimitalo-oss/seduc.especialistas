import * as dados from '../dados.js';
import { S, pode, carregarBase, especialistas } from '../estado.js';
import { ESPECIALIDADES, localizarEscola } from '../dominio.js';
import { esc, vazio, modal, campo, opcoes, aviso, erro, $, $$ } from '../ui.js';

const INICIAIS = [
  ['doutor-joao-souza-lima', 'Escola Municipal Doutor João de Souza Lima', 'escola'],
  ['professora-terezinha-sarmento', 'Escola Municipal Professora Terezinha Sarmento de Oliveira', 'escola'],
  ['prefeito-jose-pedro', 'Escola Municipal Prefeito José Pedro da Silva', 'escola'],
  ['monteiro-lobato', 'Escola Municipal Monteiro Lobato', 'escola'],
  ['creche-wilma-gloria', 'Creche Municipal Wilma Glória Nunes Mourão', 'creche'],
  ['creche-sebastiana-duarte-cabral', 'Creche Sebastiana Duarte Cabral', 'creche']
];

export async function render(main) {
  const g = pode.gerenciar();
  const contagem = id => S.estudantes.filter(e => e.escola_id === id && (e.situacao || 'ativo') === 'ativo').length;
  const profsDa = id => especialistas().filter(u => !(u.escolas || []).length || u.escolas.includes(id)).map(u => esc(u.nome.split(' ')[0]) + ' <small class="nota">(' + esc((ESPECIALIDADES[u.especialidade] || '').slice(0, 5)) + '.)</small>').join('<br>') || '—';
  const faltam = INICIAIS.filter(([id]) => !localizarEscola(id, S.escolas));
  main.innerHTML = '<header class="pagina-topo"><div><h1>Escolas</h1><p>Instituições da rede municipal atendidas pela equipe.</p></div>'
    + (g ? '<div class="acoes-linha">' + (faltam.length ? '<button class="btn sec" id="semear">Adicionar as ' + faltam.length + ' escolas da rede</button>' : '') + '<button class="btn" id="nova">+ Nova escola</button></div>' : '') + '</header>'
    + (S.escolas.length ? '<section class="cartao"><table class="tabela"><thead><tr><th>Instituição</th><th>Tipo</th><th>INEP</th><th>Telefone</th><th>Direção</th><th>Profissionais que atendem</th><th>Alunos ativos</th>' + (g ? '<th></th>' : '') + '</tr></thead><tbody>'
      + S.escolas.map(e => '<tr><td><strong>' + esc(e.nome) + '</strong><br><small class="nota">' + esc(e.endereco || '') + '</small></td><td>' + (e.tipo === 'creche' ? 'Creche' : 'Escola') + '</td><td>' + esc(e.inep || '—') + '</td><td>' + esc(e.telefone || '—') + '</td><td>' + esc(e.direcao || '—') + '</td><td>' + profsDa(e.id) + '</td><td class="num">' + contagem(e.id) + '</td>' + (g ? '<td><button class="btn sec pequeno" data-editar="' + esc(e.id) + '">Editar</button></td>' : '') + '</tr>').join('')
      + '</tbody></table></section>' : vazio('Nenhuma escola cadastrada.', g ? 'Use "Adicionar as escolas da rede".' : ''));
  $('#nova', main)?.addEventListener('click', () => editar());
  $$('[data-editar]', main).forEach(b => b.onclick = () => editar(S.escolas.find(e => e.id === b.dataset.editar)));
  $('#semear', main)?.addEventListener('click', async () => {
    try { for (const [id, nome, tipo] of faltam) await dados.salvarEscola(id, { nome, tipo, inep: '', telefone: '', endereco: '', email: '', direcao: '' }); await carregarBase(); aviso('Escolas adicionadas.'); render(main); } catch (e) { erro(e); }
  });

  function editar(e = {}) {
    modal({
      titulo: e.id ? 'Editar escola' : 'Nova escola',
      corpo: '<div class="grade">' + campo('nome', 'Nome oficial', { valor: e.nome, obrig: true, largo: true, extra: 'maxlength="200"' }) + opcoes('tipo', 'Tipo', [['escola', 'Escola'], ['creche', 'Creche']], { valor: e.tipo || 'escola' })
        + campo('inep', 'Código INEP', { valor: e.inep, extra: 'maxlength="20"' }) + campo('telefone', 'Telefone', { valor: e.telefone, extra: 'maxlength="40"' }) + campo('email', 'E-mail', { tipo: 'email', valor: e.email, extra: 'maxlength="200"' })
        + campo('direcao', 'Diretor(a)', { valor: e.direcao, extra: 'maxlength="180"' }) + campo('endereco', 'Endereço', { valor: e.endereco, largo: true, extra: 'maxlength="300"' }) + '</div>',
      aoSalvar: async d => {
        await dados.salvarEscola(e.id, { nome: d.nome.trim(), tipo: d.tipo, inep: d.inep.trim(), telefone: d.telefone.trim(), endereco: d.endereco.trim(), email: d.email.trim(), direcao: d.direcao.trim() });
        await carregarBase(); aviso('Escola salva.'); render(main);
      }
    });
  }
}
