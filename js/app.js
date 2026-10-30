import { firebaseConfig } from './config.js';
import * as dados from './dados.js';
import { S, pode, carregarBase, escolasDaPessoa, escolaCurta, nomeEscola } from './estado.js';
import { eventos } from './formularios.js';
import { PERFIS, ESPECIALIDADES } from './dominio.js';
import { esc, iniciais, erro, fecharModal, aviso } from './ui.js';
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
    + '<p class="nota">Rede Municipal de Ensino de Frei Inocêncio/MG — Fonoaudiologia, Neuropsicologia e Psicopedagogia.</p>'
    + (msg ? '<div class="alerta-caixa ' + tipo + '" role="status">' + msg + '</div>' : '')
    + (S.user ? '<button class="btn sec" id="sair">Sair desta conta</button>'
      : '<form id="form-login" class="login-form" novalidate>'
        + '<label class="campo"><span>E-mail</span><input type="email" name="email" autocomplete="username" required></label>'
        + '<label class="campo"><span>Senha</span><input type="password" name="senha" autocomplete="current-password" required></label>'
        + '<p class="form-erro" role="alert" hidden></p>'
        + '<button class="btn grande" type="submit" id="entrar-senha">Entrar</button>'
        + '<button class="link" type="button" id="esqueci">Esqueci minha senha / primeiro acesso</button></form>'
        + '<div class="ou"><span>ou</span></div><button class="btn sec grande" id="entrar"><span class="g">G</span> Entrar com Google</button>')
    + '<p class="rodape-login">Acesso restrito à equipe autorizada pela Secretaria de Educação. Os dados de crianças são protegidos pela LGPD (Lei 13.709/2018).</p>'
    + '</section></main>';
  document.getElementById('entrar')?.addEventListener('click', async () => { try { await dados.entrar(); } catch (e) { if (e.code !== 'auth/popup-closed-by-user') telaLogin('Não foi possível entrar: ' + esc(e.message), 'erro'); } });
  document.getElementById('sair')?.addEventListener('click', () => dados.sair());
  const form = document.getElementById('form-login');
  if (form) {
    const msgErro = form.querySelector('.form-erro');
    const falha = t => { msgErro.textContent = t; msgErro.hidden = false; };
    form.onsubmit = async ev => {
      ev.preventDefault(); msgErro.hidden = true;
      if (!form.email.value.trim() || !form.senha.value) return falha('Informe e-mail e senha.');
      const btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Entrando…';
      try { await dados.entrarComSenha(form.email.value, form.senha.value); }
      catch (e) {
        btn.disabled = false; btn.textContent = 'Entrar';
        falha(['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'].includes(e.code) ? 'E-mail ou senha incorretos.'
          : e.code === 'auth/too-many-requests' ? 'Muitas tentativas. Aguarde alguns minutos ou redefina a senha.'
          : e.code === 'auth/operation-not-allowed' ? 'Login por senha ainda não ativado no Firebase. Use o Google.' : 'Não foi possível entrar: ' + e.message);
      }
    };
    document.getElementById('esqueci').onclick = async () => {
      if (!form.email.value.trim()) return falha('Digite seu e-mail acima e clique novamente.');
      try { await dados.recuperarSenha(form.email.value); }
      catch (e) { if (e.code === 'auth/invalid-email') return falha('E-mail inválido.'); }
      msgErro.hidden = true; aviso('Se o e-mail estiver cadastrado, você receberá um link para criar ou redefinir a senha.');
    };
  }
}

const TERMO_VERSAO = 'lgpd-2026-10';
function telaTermo() {
  return new Promise(resolve => {
    raiz.innerHTML = '<main class="login"><section class="login-cartao termo"><h1>Termo de responsabilidade e sigilo (LGPD)</h1>'
      + '<p>Este sistema reúne dados pessoais e de saúde de crianças e adolescentes, que são dados sensíveis (Lei 13.709/2018, arts. 11 e 14). Ao acessar, declaro que:</p>'
      + '<ol><li>usarei as informações exclusivamente para o atendimento e o acompanhamento educacional dos alunos;</li>'
      + '<li>manterei sigilo profissional e não copiarei, fotografarei nem compartilharei dados fora do sistema, salvo documentos destinados à família ou à escola;</li>'
      + '<li>não compartilharei minha senha e sairei do sistema ao usar computadores compartilhados;</li>'
      + '<li>registrarei apenas informações necessárias ao atendimento;</li>'
      + '<li>sei que os acessos e alterações ficam registrados com minha identificação.</li></ol>'
      + '<button class="btn grande" id="aceitar">Li e concordo</button><button class="link" id="recusar">Não concordo — sair</button></section></main>';
    document.getElementById('aceitar').onclick = async () => {
      try { await dados.aceitarTermo(S.user.uid, TERMO_VERSAO); S.perfil.termo_lgpd = TERMO_VERSAO; resolve(true); } catch (e) { erro(e); }
    };
    document.getElementById('recusar').onclick = () => { dados.sair(); resolve(false); };
  });
}

function telaInstituicao() {
  return new Promise(resolve => {
    const lista = escolasDaPessoa();
    const todas = S.perfil.perfil !== 'direcao' || lista.length > 1;
    raiz.innerHTML = '<main class="login"><section class="login-cartao instituicoes"><h1>Onde você está atendendo?</h1>'
      + '<p class="nota">Escolha a instituição para ver a agenda e os alunos de lá. Você pode trocar a qualquer momento no topo da tela.</p>'
      + '<div class="lista-inst">' + lista.map(e => '<button class="inst" data-inst="' + esc(e.id) + '"><strong>' + esc(escolaCurta(e.id)) + '</strong><small>' + esc(e.tipo === 'creche' ? 'Creche' : 'Escola') + '</small></button>').join('')
      + (todas ? '<button class="inst todas" data-inst=""><strong>Todas as instituições</strong><small>Visão geral da rede</small></button>' : '') + '</div></section></main>';
    raiz.querySelectorAll('[data-inst]').forEach(b => b.onclick = () => { S.instituicao = b.dataset.inst; try { sessionStorage.setItem('inst:' + S.user.uid, S.instituicao); } catch {} resolve(); });
  });
}
async function escolherInstituicao(forcar = false) {
  const lista = escolasDaPessoa();
  let salva = null; try { salva = sessionStorage.getItem('inst:' + S.user.uid); } catch {}
  if (!forcar && salva !== null && (salva === '' || lista.some(e => e.id === salva))) { S.instituicao = salva; return; }
  if (lista.length === 1 && S.perfil.perfil !== 'superadmin' && S.perfil.perfil !== 'secretaria') { S.instituicao = lista[0].id; return; }
  if (!lista.length) { S.instituicao = ''; return; }
  await telaInstituicao();
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
    + '<div class="lateral-rodape">Rede Municipal de Ensino<br>Frei Inocêncio/MG<br><button class="link claro" id="ver-lgpd">Privacidade (LGPD)</button></div></aside>'
    + '<div class="area"><header class="topo"><button class="icone-btn menu-movel" id="abrir-menu" aria-label="Abrir menu">☰</button>'
    + '<button class="inst-atual" id="trocar-inst" title="Trocar instituição"><small>Instituição</small><strong>' + esc(S.instituicao ? escolaCurta(S.instituicao) : 'Todas as instituições') + '</strong><span aria-hidden="true">⇄</span></button>'
    + '<div class="topo-usuario"><span class="avatar">' + esc(iniciais(S.perfil.nome)) + '</span><div><strong>' + esc(S.perfil.nome) + '</strong><small>' + esc(papel) + '</small></div>'
    + '<button class="btn sec pequeno" id="sair">Sair</button></div></header>'
    + '<main id="conteudo" class="conteudo" tabindex="-1"></main></div></div>';
  document.getElementById('sair').onclick = () => dados.sair();
  document.getElementById('trocar-inst').onclick = async () => { await escolherInstituicao(true); renderizar(); };
  document.getElementById('ver-lgpd').onclick = () => import('./ui.js').then(u => u.modal({ titulo: 'Privacidade e LGPD', somenteLeitura: true, corpo: '<p>Os dados são usados só para o atendimento especializado da rede municipal. Texto clínico: somente a equipe de especialistas. Direção e Secretaria: dados cadastrais, agenda e indicadores. Registros não são apagados (guarda do prontuário); correções geram versões. Termo aceito em ' + esc(S.perfil.termo_lgpd_em?.toDate ? S.perfil.termo_lgpd_em.toDate().toLocaleString('pt-BR') : '—') + '.</p>' }));
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
      if (perfil.termo_lgpd !== TERMO_VERSAO && !(await telaTermo())) return;
      await carregarBase();
      await escolherInstituicao();
      await renderizar();
    } catch (e) { erro(e); telaLogin('Não foi possível verificar seu acesso: ' + esc(e.message), 'erro'); }
  });
}
iniciar();
