import { firebaseConfig } from './config.js';
import * as dados from './dados.js';
import { S, pode, carregarBase } from './estado.js';
import { eventos } from './formularios.js';
import { PERFIS, ESPECIALIDADES } from './dominio.js';
import { esc, iniciais, erro, fecharModal } from './ui.js';
import * as painel from './paginas/painel.js';
import * as alunos from './paginas/alunos.js';
import * as prontuario from './paginas/prontuario.js';
import * as agenda from './paginas/agenda.js';
import * as relatorios from './paginas/relatorios.js';
import * as equipe from './paginas/equipe.js';
import * as escolas from './paginas/escolas.js';

const raiz = document.getElementById('app');
const PAGINAS = {
  painel: { titulo: 'Painel', mod: painel, icone: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
  alunos: { titulo: 'Alunos', mod: alunos, icone: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a7 7 0 0 1 14 0v1M17 11a3 3 0 1 0 0-6M22 21v-1a5 5 0 0 0-4-4.9' },
  aluno: { titulo: 'Prontuário', mod: prontuario, menu: false },
  agenda: { titulo: 'Agenda', mod: agenda, icone: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4' },
  relatorios: { titulo: 'Relatórios', mod: relatorios, icone: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  equipe: { titulo: 'Equipe', mod: equipe, icone: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a8 8 0 0 1 16 0v1' },
  escolas: { titulo: 'Escolas', mod: escolas, icone: 'M3 10l9-6 9 6v10H3zM9 20v-6h6v6' }
};
const svg = d => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';

function telaLogin(msg = '', tipo = 'info') {
  raiz.innerHTML = '<main class="login"><section class="login-cartao">'
    + '<div class="marca"><span class="marca-simbolo">✳</span><div><strong>SEDUC Especialistas</strong><small>Prontuário do atendimento especializado</small></div></div>'
    + '<h1>Acompanhamento compartilhado das crianças atendidas pela equipe de Fonoaudiologia, Neuropsicologia e Psicopedagogia.</h1>'
    + '<p class="nota">Rede Municipal de Ensino de Frei Inocêncio/MG. Acesso restrito à equipe e às pessoas autorizadas pela Secretaria de Educação.</p>'
    + (msg ? '<div class="alerta-caixa ' + tipo + '" role="status">' + msg + '</div>' : '')
    + (S.user ? '<button class="btn sec" id="sair">Sair desta conta</button>' : '<button class="btn grande" id="entrar"><span class="g">G</span> Entrar com Google</button>')
    + '<p class="rodape-login">Os dados de crianças são protegidos pela LGPD. Use o sistema somente para a finalidade do atendimento.</p>'
    + '</section></main>';
  document.getElementById('entrar')?.addEventListener('click', async () => { try { await dados.entrar(); } catch (e) { if (e.code !== 'auth/popup-closed-by-user') telaLogin('Não foi possível entrar: ' + esc(e.message), 'erro'); } });
  document.getElementById('sair')?.addEventListener('click', () => dados.sair());
}

function menu() {
  const p = S.perfil.perfil;
  const itens = ['painel', 'alunos', 'agenda', 'relatorios', 'equipe'];
  if (pode.gerenciar() || p === 'secretaria') itens.push('escolas');
  return itens;
}

function moldura() {
  const atual = S.rota.pagina === 'aluno' ? 'alunos' : S.rota.pagina;
  const papel = S.perfil.perfil === 'especialista' ? ESPECIALIDADES[S.perfil.especialidade] || 'Especialista' : PERFIS[S.perfil.perfil];
  raiz.innerHTML = '<div class="casca">'
    + '<aside class="lateral"><a class="marca" href="#/painel"><span class="marca-simbolo">✳</span><div><strong>SEDUC</strong><small>Especialistas</small></div></a>'
    + '<nav aria-label="Principal">' + menu().map(k => '<a href="#/' + k + '" class="nav' + (atual === k ? ' ativo' : '') + '"' + (atual === k ? ' aria-current="page"' : '') + '>' + svg(PAGINAS[k].icone) + '<span>' + PAGINAS[k].titulo + '</span></a>').join('') + '</nav>'
    + '<div class="lateral-rodape">Rede Municipal de Ensino<br>Frei Inocêncio/MG</div></aside>'
    + '<div class="area"><header class="topo"><button class="icone-btn menu-movel" id="abrir-menu" aria-label="Abrir menu">☰</button>'
    + '<div class="topo-usuario"><span class="avatar">' + esc(iniciais(S.perfil.nome)) + '</span><div><strong>' + esc(S.perfil.nome) + '</strong><small>' + esc(papel) + '</small></div>'
    + '<button class="btn sec pequeno" id="sair">Sair</button></div></header>'
    + '<main id="conteudo" class="conteudo" tabindex="-1"></main></div></div>';
  document.getElementById('sair').onclick = () => dados.sair();
  document.getElementById('abrir-menu').onclick = () => raiz.querySelector('.casca').classList.toggle('menu-aberto');
}

function lerRota() {
  const [pagina = 'painel', id = '', aba = ''] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  S.rota = { pagina: PAGINAS[pagina] ? pagina : 'painel', id, aba };
  if (!menu().includes(S.rota.pagina) && S.rota.pagina !== 'aluno') S.rota.pagina = 'painel';
}

let renderizando = 0;
async function renderizar() {
  if (!S.perfil) return;
  const vez = ++renderizando;
  lerRota(); fecharModal(); moldura();
  const main = document.getElementById('conteudo');
  main.innerHTML = '<div class="carregando" role="status">Carregando…</div>';
  try {
    await PAGINAS[S.rota.pagina].mod.render(main, () => vez === renderizando);
    document.title = PAGINAS[S.rota.pagina].titulo + ' · SEDUC Especialistas';
  } catch (e) {
    if (vez !== renderizando) return;
    main.innerHTML = '<div class="alerta-caixa erro">Não foi possível carregar esta tela. ' + esc(String(e?.code || '').includes('permission') ? 'Sua conta não tem permissão para estes dados.' : e.message) + '</div>';
    console.error(e);
  }
}
eventos.aoMudar = renderizar;
window.addEventListener('hashchange', renderizar);

async function iniciar() {
  if (!firebaseConfig?.projectId) { raiz.innerHTML = '<p>Configure js/config.js</p>'; return; }
  dados.iniciar(firebaseConfig);
  dados.observarSessao(async u => {
    S.user = u; S.perfil = null;
    if (!u) return telaLogin();
    raiz.innerHTML = '<div class="carregando tela-cheia">Verificando acesso…</div>';
    try {
      const perfil = await dados.carregarOuCriarPerfil(u);
      if (!['especialista', 'secretaria', 'direcao', 'superadmin'].includes(perfil.perfil) || !perfil.ativo || perfil.excluido)
        return telaLogin(perfil.perfil === 'pendente' ? 'Seu acesso foi solicitado e aguarda liberação da administração.<br><small>Conta: ' + esc(u.email) + '</small>' : 'Seu acesso está desativado. Procure a Secretaria de Educação.', 'aviso');
      S.perfil = perfil;
      await carregarBase();
      await renderizar();
    } catch (e) { erro(e); telaLogin('Não foi possível verificar seu acesso: ' + esc(e.message), 'erro'); }
  });
}
iniciar();
