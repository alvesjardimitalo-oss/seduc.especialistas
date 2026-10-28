import {estadosMeta,indicadoresConsultas,analisarAcompanhamento,validarMeta} from './evolucao.mjs';
import {consultasDoAluno,validarRelatorio,filtrarConsultas} from './aluno-historico.mjs';
import {resumirRelatorio,filtrarRegistros} from './relatorios.mjs';
import {firebaseConfig} from './firebase-config.js';
import {montarListaProfissionais} from './profissionais-visao.mjs';
import {resumirAluno,agruparConsultasPorAluno,etiquetasEvolucao} from './consultas-resumo.mjs';
import {montarDocumentoAluno,montarDocumentoGerencial} from './relatorios-impressao.mjs';
import {buscarAlunosDisponiveis} from './busca-alunos.mjs';
import {prepararCadastroAluno,consultarCEP,formatarCEP,formatarCPF,formatarTelefone} from './cadastro-alunos.mjs';
import {conferirImportacao,conferirAlunosEspeciais,encontrarEscola,escolasImportacao} from './importacao-servidores.mjs';
import {cpfValido,lerHorarios,gerarSlotsSemana,podeAgendar,dentroDaJornada} from './validacoes.mjs';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {getFirestore,collection,doc,getDoc,getDocs,setDoc,addDoc,updateDoc,writeBatch,runTransaction,serverTimestamp,query,where} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const root=document.getElementById('app');
const configured=firebaseConfig.projectId==='seduc-especialistas' && firebaseConfig.authDomain==='seduc-especialistas.firebaseapp.com' && !Object.values(firebaseConfig).some(v=>!v||String(v)==='CONFIGURAR');
const schoolNames=['Escola Municipal Doutor João de Souza Lima','Escola Municipal Professora Terezinha Sarmento de Oliveira','Creche Municipal Wilma Glória Nunes Mourão','Escola Municipal Prefeito José Pedro da Silva','Escola Municipal Monteiro Lobato','Creche Sebastiana Duarte Cabral'];
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatDate=x=>{if(!x)return '—';const d=x?.toDate?x.toDate():new Date(x);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR')};
const dataMs=x=>{if(!x)return 0;const d=x?.toDate?x.toDate():new Date(x);return Number.isNaN(d.getTime())?0:d.getTime()};
let auth,db,user,profile,tab='Painel',cache={escolas:[],profissionais:[],vinculos:[],alunos:[],agendamentos:[],atendimentos:[],notas_atendimento:[],usuarios:[],frequencias:[],servidores:[],alunos_necessidades:[],relatorios_alunos:[],metas_alunos:[],revisoes_metas:[]};
let filtrosRelatorio={de:'',ate:'',escola:'',aluno:'',profissional:'',especialidade:''};
let filtrosAgenda={},filtrosAtendimentos={};
let alunoSelecionado=null,filtrosConsulta={},erroRelatorios=false,erroMetas=false,errosCarregamento=[];
const TERMOS_VERSAO='2026-10-28-v1';
let termosSessaoConfirmados=false;
const canManage=()=>profile?.perfil==='superadmin'||(profile?.perfil==='secretaria'&&profile?.gerenciar===true);
const canWrite=()=>profile?.perfil==='especialista';
const mySchools=()=>profile?.perfil==='superadmin'||profile?.perfil==='secretaria'?cache.escolas:cache.escolas.filter(e=>(profile?.escolas||[]).includes(e.id));
const schoolName=id=>cache.escolas.find(s=>s.id===id)?.nome||'Instituição';
const professionalName=uid=>cache.profissionais.find(p=>p.uid===uid)?.nome||cache.atendimentos.find(a=>a.autor_uid===uid)?.autor_nome||'Profissional';
const btn=(txt,action='')=>'<button class="btn '+(action==='secondary'?'secondary':'')+'">'+safe(txt)+'</button>';
function showError(err){
 const causes={
  'auth/unauthorized-domain':'Domínio da aplicação não autorizado no Firebase Authentication. Cadastre o domínio de hospedagem em Authentication > Settings > Authorized domains.',
  'auth/operation-not-allowed':'Login Google não habilitado no projeto Firebase. Ative o provedor Google em Authentication > Sign-in method.',
  'auth/popup-blocked':'O navegador bloqueou a janela de login Google. Permita pop-ups para esta aplicação.',
  'permission-denied':'Sem permissão para acessar o Firestore. Verifique se as regras oficiais foram publicadas e se o usuário foi aprovado.'
 };
 alert('Não foi possível concluir: '+(causes[err?.code]||err?.message||String(err)));
}
function showLogin(message=''){
 const pendente=Boolean(user&&profile&&!profile.ativo);
 root.innerHTML='<div class="auth-page"><div class="auth-visual">'+
 '<div class="auth-brand"><span class="brand-symbol" aria-hidden="true">✳</span><span>SEDUC <b>Especialistas</b></span></div>'+
 '<div class="auth-story"><span class="eyebrow light">EDUCAÇÃO QUE ACOLHE</span><h2>Cada atendimento faz a diferença.</h2><p>Um espaço para conectar profissionais, escolas e acompanhamento especializado em uma só jornada.</p></div>'+
 '<div class="auth-footer">Plataforma de gestão do atendimento especializado</div></div>'+
 '<div class="auth-panel"><div class="auth-card"><div class="auth-mobile-brand"><span class="brand-symbol" aria-hidden="true">✳</span><strong>SEDUC Especialistas</strong></div>'+
 '<div class="auth-welcome"><span class="eyebrow">ACESSO À PLATAFORMA</span><h1>Bem-vindo(a) de volta</h1><p>Entre para acompanhar as atividades da rede de ensino.</p></div>'+
 '<div class="auth-warning"><span aria-hidden="true">ⓘ</span> Ambiente de homologação. Use apenas informações fictícias de alunos.</div>'+ 
 '<div class="auth-security-note" role="note"><strong>Proteção de dados e sigilo profissional</strong><p>Este sistema utiliza informações de alunos e responsáveis. Acesse apenas o necessário para suas funções, não compartilhe senhas, documentos, consultas ou relatórios, e mantenha a sessão protegida. Conforme a LGPD, os dados devem ser tratados para finalidades autorizadas e com segurança.</p><small>Após o login, será solicitado que você leia e confirme a ciência dos Termos de Uso e Responsabilidade.</small></div>'+
 (message?'<div class="alert" role="status">'+safe(message)+'</div>':'')+
 (pendente?'<div class="pending-profile"><strong>Conta aguardando liberação</strong><p>'+safe(user.email)+'</p><label>Identificador para a Secretaria</label><code>'+safe(user.uid)+'</code></div><button class="btn secondary auth-btn" id="trocar">Sair e trocar conta</button>':
 '<button class="btn auth-btn" id="google"><span class="google-mark" aria-hidden="true">G</span> Entrar com Google <span class="auth-arrow" aria-hidden="true">→</span></button>')+
 '<p class="auth-terms">Acesso restrito a profissionais autorizados pela Secretaria Municipal de Educação.</p></div></div></div>';
 if(pendente)document.getElementById('trocar').onclick=()=>signOut(auth).catch(showError);
 else document.getElementById('google').onclick=()=>signInWithPopup(auth,new GoogleAuthProvider()).catch(showError);
}

function textoAvisoSeguranca(){
 return '<div class="privacy-list"><p><strong>Finalidade:</strong> utilizar dados pessoais exclusivamente para cadastro escolar, agendamentos, acompanhamento especializado e relatórios autorizados pela Secretaria de Educação.</p>'+
 '<p><strong>Sigilo:</strong> é proibido compartilhar cadastros, CPF, endereços, relatórios, histórico de atendimentos ou credenciais com pessoas não autorizadas; não fotografar telas nem enviar documentos por canais pessoais.</p>'+
 '<p><strong>Segurança da informação:</strong> mantenha dispositivo e conta protegidos, saia ao terminar, evite computadores públicos e comunique imediatamente qualquer acesso indevido ou suspeita de vazamento ao responsável institucional.</p>'+
 '<p><strong>Crianças e adolescentes:</strong> o tratamento deve observar o melhor interesse do aluno, a necessidade e a finalidade institucional. Nunca registre informação desnecessária.</p>'+
 '<p><strong>Responsabilidade:</strong> a confirmação abaixo registra ciência dos deveres de uso da plataforma. <strong>Não substitui a base legal de tratamento, o aviso de privacidade institucional nem eventual consentimento de pais ou responsáveis quando exigido.</strong></p></div>'+
 '<p class="privacy-law">Referência: <a target="_blank" rel="noopener noreferrer" href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm">Lei 13.709/2018 (LGPD)</a> — especialmente art. 14 para crianças e adolescentes.</p>';
}
async function mostrarTermosSeguranca(){
 if(!user||!profile?.ativo)return;
 let aceiteAnterior=false,registroDisponivel=true;
 try{const s=await getDoc(doc(db,'termos_aceites',user.uid+'_'+TERMOS_VERSAO));aceiteAnterior=s.exists()&&s.data()?.versao===TERMOS_VERSAO}
 catch(e){registroDisponivel=false;console.warn('Registro de ciência dos termos indisponível:',e.code||e.message)}
 root.innerHTML='<div class="lgpd-gate"><section class="lgpd-panel" role="dialog" aria-modal="true" aria-labelledby="lgpd-title">'+
 '<span class="eyebrow">ACESSO SEGURO · LGPD</span><h1 id="lgpd-title">Proteção de dados e responsabilidade</h1>'+
 '<p class="muted">Antes de acessar informações de alunos, leia o aviso de segurança. Este lembrete aparece em cada login.</p>'+
 textoAvisoSeguranca()+
 (!registroDisponivel?'<p class="alert" role="alert">Registro central de termos indisponível. A ciência poderá ser confirmada nesta sessão, mas sua gravação no Firestore ainda depende das regras publicadas.</p>':'')+
 '<label class="privacy-check"><input id="lgpd-confirmar" type="checkbox"><span>Li e compreendi os deveres de sigilo, uso autorizado e segurança da informação, e me comprometo a respeitá-los.</span></label>'+
 '<div class="privacy-actions"><button id="lgpd-sair" type="button" class="btn secondary">Sair da conta</button><button id="lgpd-entrar" type="button" class="btn" disabled>Estou ciente · continuar</button></div>'+
 '<p id="lgpd-status" class="muted" role="status"></p>'+
 '<p class="privacy-version">Termos de uso e responsabilidade · versão '+TERMOS_VERSAO+(aceiteAnterior?' · ciência previamente registrada':'')+'</p></section></div>';
 const checkbox=document.getElementById('lgpd-confirmar'),button=document.getElementById('lgpd-entrar');
 checkbox.onchange=()=>button.disabled=!checkbox.checked;
 document.getElementById('lgpd-sair').onclick=()=>signOut(auth).catch(showError);
 button.onclick=async()=>{
  if(!checkbox.checked||termosSessaoConfirmados)return;
  button.disabled=true;
  const status=document.getElementById('lgpd-status');status.textContent='Validando acesso...';
  let registrado=aceiteAnterior;
  if(!aceiteAnterior){
   try{
    await setDoc(doc(db,'termos_aceites',user.uid+'_'+TERMOS_VERSAO),{
     uid:user.uid,versao:TERMOS_VERSAO,tipo:'ciencia_termos_uso',aceito_em:serverTimestamp()
    });
    registrado=true;
   }catch(e){
    // Não indisponibilizar a conta por uma alteração ainda não publicada de regras.
    console.warn('Ciência dos termos sem registro central:',e.code||e.message);
    registrado=false;
   }
  }
  termosSessaoConfirmados=true;
  try{
   await refresh();render();
   if(!registrado){
    const aviso=document.createElement('p');aviso.className='alert privacy-storage-warning';aviso.setAttribute('role','alert');
    aviso.textContent='LGPD: ciência confirmada nesta sessão, mas o registro central dos termos não pôde ser gravado. A administração precisa publicar as regras de segurança no Firestore.';
    root.querySelector('.app-content')?.prepend(aviso);
   }
  }catch(e){termosSessaoConfirmados=false;showError(e);button.disabled=false}
 };
}

function showSetup(){root.innerHTML='<div class="login"><div class="card"><h1>SEDUC Especialistas</h1><div class="alert">Ambiente ainda não configurado. Nenhum dado real pode ser registrado.</div><p>Configure um projeto Firebase exclusivo em <code>assets/js/firebase-config.js</code> e publique as regras de segurança do arquivo <code>firestore.rules</code>.</p><p class="muted">Não utilize o Firebase do SISDIFI. O acesso inicial do superadministrador deve ser provisionado de modo seguro.</p></div></div>'}
async function initialize(){if(!configured){showSetup();return}const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);onAuthStateChanged(auth,async u=>{user=u;if(!u){profile=null;termosSessaoConfirmados=false;showLogin();return}try{const ref=doc(db,'usuarios',u.uid);let s=await getDoc(ref);if(!s.exists()){await setDoc(ref,{nome:u.displayName||u.email,email:u.email,ativo:false,perfil:'pendente',escolas:[],gerenciar:false,criado_em:serverTimestamp()});s=await getDoc(ref)}profile={id:s.id,...s.data()};if(!profile.ativo){showLogin('Sua conta foi registrada e está aguardando liberação da Secretaria de Educação.');return}termosSessaoConfirmados=false;await mostrarTermosSeguranca()}catch(e){showLogin('Não foi possível verificar a autorização: '+e.message)}})}
async function refresh(){
 const manager=canManage();erroRelatorios=false;erroMetas=false;errosCarregamento=[];
 const schools=(manager||profile.perfil==='secretaria')?(await getDocs(collection(db,'escolas'))).docs.map(d=>({id:d.id,...d.data()})):(await Promise.all((profile.escolas||[]).map(async id=>{try{const s=await getDoc(doc(db,'escolas',id));return s.exists()?{id:s.id,...s.data()}:null}catch{return null}}))).filter(Boolean);
 const ids=schools.map(x=>x.id);
 const out={escolas:schools,profissionais:[],vinculos:[],alunos:[],agendamentos:[],atendimentos:[],notas_atendimento:[],usuarios:[],frequencias:[],servidores:[],alunos_necessidades:[],relatorios_alunos:[],metas_alunos:[],revisoes_metas:[]};
 for(const key of Object.keys(out).filter(x=>x!=='escolas')){
  try{
   if(profile.perfil==='secretaria'&&['profissionais','vinculos','alunos','agendamentos','atendimentos','frequencias','relatorios_alunos','metas_alunos','revisoes_metas'].includes(key)){const r=await getDocs(collection(db,key));out[key]=r.docs.map(d=>({id:d.id,...d.data()}));continue}
   if(['relatorios_alunos','metas_alunos','revisoes_metas'].includes(key)&&!['superadmin','especialista','secretaria'].includes(profile.perfil))continue;
   if(manager){if(profile.perfil==='secretaria'&&['notas_atendimento','alunos_privado'].includes(key))continue;if(key==='alunos_necessidades'&&profile.perfil!=='superadmin')continue;const r=await getDocs(collection(db,key));out[key]=r.docs.map(d=>({id:d.id,...d.data()}));continue}
   if(key==='profissionais'||key==='usuarios'||key==='servidores'||(key==='alunos_necessidades'&&profile.perfil!=='especialista')||(key==='notas_atendimento'&&profile.perfil!=='especialista')){continue}
   // Firestore rules don't filter query results. Restrict every read to authorized school IDs.
   for(let i=0;i<ids.length;i+=10){
    const chunk=ids.slice(i,i+10);if(!chunk.length)continue;
    const r=await getDocs(query(collection(db,key),where('escola_id','in',chunk)));
    out[key].push(...r.docs.map(d=>({id:d.id,...d.data()})));
   }
  }catch(e){if(key==='relatorios_alunos')erroRelatorios=true;if(['metas_alunos','revisoes_metas'].includes(key))erroMetas=true;errosCarregamento.push(key);console.warn('Falha ao carregar '+key,e.code||e.message)}
 }
 if(manager){try{const r=await getDocs(collection(db,'usuarios'));out.usuarios=r.docs.map(d=>({id:d.id,...d.data()}))}catch(e){console.warn('Sem acesso a usuários:',e.message)}}
 cache=out;
 for(const a of cache.atendimentos){a.texto=cache.notas_atendimento.find(n=>n.id===a.id)?.texto||''}
}
function uiIcon(name,cls=''){
 const paths={
  'Painel':'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  'Escolas':'<path d="m3 10 9-6 9 6v10H3z"/><path d="M9 20v-7h6v7M3 10h18"/>',
  'Profissionais':'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 8h4M19 6v4M17 16h4"/>',
  'Alunos':'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 15a5 5 0 0 1 5 5"/>',
  'Agenda':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 15h3M14 15h2"/>',
  'Atendimentos':'<rect x="4" y="3" width="16" height="19" rx="2"/><path d="M9 3.5h6M12 10v8M8 14h8"/>',
  'Frequência':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  'Relatórios':'<path d="M5 20V9M11 20V4M17 20v-7M3 20h18"/>',
  'Tutorial':'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.7 2.7 0 1 1 4.4 2.1c-1.2.9-1.9 1.2-1.9 2.9M12 17h.01"/>',
  'Servidores':'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 5V3M16 5V3M7 11h10M7 15h6"/>',
  'Usuários':'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 10h4M19 8v4M16 17h5"/>',
  'chevron':'<path d="m9 18 6-6-6-6"/>',
  'arrow':'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  'spark':'<path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>'
 };
 return '<svg class="'+safe(cls)+'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[name]||paths.Painel)+'</svg>';
}
function layout(content){
 const items=['Painel','Escolas','Profissionais','Alunos','Agenda','Atendimentos','Frequência','Relatórios','Tutorial'];
 if(canManage())items.push('Servidores','Usuários');
 const roleNames={superadmin:'Administração',secretaria:'Secretaria',especialista:'Especialista',direcao:'Direção',visualizador:'Consulta'};
 const menuGroup=(group,label)=>'<div class="nav-group-label">'+label+'</div>'+group.map(n=>'<button type="button" class="nav-link'+(tab===n?' active':'')+'" data-tab="'+safe(n)+'" '+(tab===n?'aria-current="page"':'')+'>'+uiIcon(n,'nav-icon')+'<span>'+safe(n)+'</span>'+(tab===n?'<span class="nav-active-dot"></span>':'')+'</button>').join('');
 const initials=String(profile.nome||user.email||'S').trim().slice(0,1).toUpperCase();
 root.innerHTML='<div class="app-shell"><aside class="app-sidebar">'+
 '<div class="app-logo"><span class="logo-mark" aria-hidden="true">✳</span><span class="logo-text">SEDUC <strong>Especialistas</strong><small>Gestão integrada</small></span></div>'+
 '<nav class="app-navigation" aria-label="Navegação principal">'+
 menuGroup(items.filter(n=>['Painel','Agenda','Atendimentos','Alunos'].includes(n)),'ATENDIMENTO')+
 menuGroup(items.filter(n=>['Escolas','Profissionais','Frequência','Relatórios','Servidores','Usuários'].includes(n)),'GESTÃO')+
 menuGroup(items.filter(n=>n==='Tutorial'),'SUPORTE')+'</nav>'+
 '<div class="sidebar-footer"><div class="sidebar-footer-icon">✳</div><div>SEDUC Especialistas<small>Rede municipal de ensino</small></div></div>'+
 '</aside><div class="app-workspace"><header class="workspace-topbar"><div class="breadcrumbs"><span>Plataforma</span>'+uiIcon('chevron','crumb-icon')+'<strong>'+safe(tab==='Painel'?'Visão geral':tab)+'</strong></div>'+
 '<div class="topbar-right"><span class="environment-chip"><i></i> Homologação</span><div class="account-block"><div class="account-avatar">'+safe(initials)+'</div><div class="account-copy"><strong>'+safe(profile.nome||user.email)+'</strong><small>'+safe(roleNames[profile.perfil]||profile.perfil||'Usuário')+'</small></div></div><button type="button" class="logout-btn" id="logout" title="Sair da conta">Sair</button></div></header>'+
 '<div class="environment-notice"><strong>Ambiente de testes.</strong> Use apenas dados fictícios até a validação das permissões e dos atendimentos.</div>'+
 '<main class="body app-content">'+(errosCarregamento.length?'<div class="alert" role="alert">Não foi possível carregar todos os módulos do Firestore: '+safe([...new Set(errosCarregamento)].join(', '))+'. Verifique as regras e os vínculos da sua conta.</div>':'')+content+'</main></div></div>';
 document.getElementById('logout').onclick=()=>signOut(auth);
 document.querySelectorAll('[data-tab]').forEach(n=>n.onclick=()=>{tab=n.dataset.tab;render()});
}
function title(name,subtitle){
 return '<div class="page-heading"><div><span class="eyebrow">SEDUC · ATENDIMENTO ESPECIALIZADO</span><h1>'+safe(name==='Painel'?'Visão geral':name)+'</h1><p class="sub">'+safe(subtitle)+'</p></div><span class="page-heading-mark" aria-hidden="true">'+uiIcon(name)+'</span></div>';
}
function table(headers,rows){
 return '<div class="card tablewrap"><table><thead><tr>'+headers.map(x=>'<th scope="col">'+safe(x)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.join(''):'<tr><td colspan="'+headers.length+'"><div class="empty-table"><span class="empty-symbol" aria-hidden="true">◌</span><strong>Nenhum registro encontrado</strong><p>Os dados aparecerão aqui assim que estiverem disponíveis.</p></div></td></tr>')+'</tbody></table></div>';
}
function render(){if(!profile?.ativo)return;let html=title(tab,'Acompanhamento de atendimentos especializados');const students=cache.alunos;const appointments=tab==='Agenda'?filtrarConsultas(cache.agendamentos,students,filtrosAgenda):cache.agendamentos;const visits=tab==='Atendimentos'?filtrarConsultas(cache.atendimentos,students,filtrosAtendimentos):cache.atendimentos;if(tab==='Painel'){
 const agora=new Date();
 const saudacao=agora.getHours()<12?'Bom dia':agora.getHours()<18?'Boa tarde':'Boa noite';
 const primeiroNome=String(profile.nome||user.displayName||'').trim().split(/\s+/)[0]||'';
 const dataExtenso=agora.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
 const futuros=appointments.filter(a=>a.status==='agendado'&&dataMs(a.inicio)>=agora.getTime()).sort((a,b)=>dataMs(a.inicio)-dataMs(b.inicio)).slice(0,5);
 const hoje=appointments.filter(a=>a.status==='agendado'&&dataMs(a.inicio)>=new Date(agora.getFullYear(),agora.getMonth(),agora.getDate()).getTime()&&dataMs(a.inicio)<new Date(agora.getFullYear(),agora.getMonth(),agora.getDate()+1).getTime()).length;
 const metricas=[['Alunos cadastrados',students.filter(x=>x.ativo!==false).length,'Alunos','teal'],['Atendimentos',visits.filter(x=>x.status==='realizado').length,'Atendimentos','blue'],['Consultas agendadas',appointments.filter(x=>x.status==='agendado').length,'Agenda','violet'],['Escolas atendidas',mySchools().length,'Escolas','amber']];
 html='<section class="dashboard-hero"><div class="hero-content"><span class="hero-tag">'+uiIcon('spark')+' SUA CENTRAL DE ATENDIMENTO</span><h1>'+saudacao+(primeiroNome?', '+safe(primeiroNome):'')+'!</h1><p>Organize atendimentos, acompanhe estudantes e mantenha a equipe conectada em um só lugar.</p>'+
 '<div class="hero-actions">'+(canWrite()?'<button class="btn btn-bright" data-action="agendar">Nova consulta '+uiIcon('arrow')+'</button><button class="btn btn-outline-light" data-action="atendimento">Registrar atendimento</button>':'<button class="btn btn-bright" data-go="Agenda">Ver agenda '+uiIcon('arrow')+'</button>')+'</div></div><div class="hero-art" aria-hidden="true"><span class="hero-orbit orbit-one"></span><span class="hero-orbit orbit-two"></span><span class="hero-center">✳</span></div></section>'+
 '<div class="section-heading"><div><h2>Resumo da rede</h2><p>Indicadores disponíveis para seu perfil</p></div><span class="summary-date">'+safe(dataExtenso)+'</span></div>'+
 '<div class="metric-grid">'+metricas.map(([label,total,ico,cor])=>'<div class="metric metric-'+cor+'"><div class="metric-top"><span>'+safe(label)+'</span><span class="metric-icon">'+uiIcon(ico)+'</span></div><b>'+total+'</b><div class="metric-footer"><span class="metric-trace"></span>Atualizado com os registros disponíveis</div></div>').join('')+'</div>'+
 '<div class="dashboard-columns"><section class="card upcoming-card"><div class="card-heading"><div><span class="eyebrow">ORGANIZAÇÃO</span><h3>Próximos agendamentos</h3><p>'+hoje+' consulta(s) prevista(s) para hoje</p></div><button class="text-button" data-go="Agenda">Abrir agenda '+uiIcon('arrow')+'</button></div>'+
 (futuros.length?'<div class="schedule-list">'+futuros.map(a=>'<div class="schedule-item"><span class="schedule-date"><strong>'+safe(new Date(dataMs(a.inicio)).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}))+'</strong><small>'+safe(new Date(dataMs(a.inicio)).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}))+'</small></span><span class="schedule-detail"><strong>'+safe(students.find(s=>s.id===a.aluno_id)?.nome||'Aluno cadastrado')+'</strong><small>'+safe(schoolName(a.escola_id))+' · '+safe(a.autor_nome||'Especialista')+'</small></span><span class="status-pill">Agendado</span></div>').join('')+'</div>':
 '<div class="dashboard-empty"><div class="empty-icon">'+uiIcon('Agenda')+'</div><strong>Agenda organizada</strong><p>Nenhuma consulta futura encontrada para seu perfil.</p></div>')+'</section>'+
 '<section class="card shortcuts-card"><div class="card-heading"><div><span class="eyebrow">ACESSOS RÁPIDOS</span><h3>O que você precisa fazer?</h3><p>Acesse os módulos principais</p></div></div><div class="shortcut-grid">'+
 [['Alunos','Fichas e acompanhamento'],['Profissionais','Equipes e jornadas'],['Atendimentos','Histórico de consultas'],['Relatórios','Dados e indicadores']].map(([label,desc])=>'<button class="shortcut-item" data-go="'+safe(label)+'">'+uiIcon(label)+'<span><strong>'+safe(label)+'</strong><small>'+safe(desc)+'</small></span>'+uiIcon('chevron','shortcut-arrow')+'</button>').join('')+'</div></section></div>'+
 '<section class="card recent-card"><div class="card-heading"><div><span class="eyebrow">ACOMPANHAMENTO</span><h3>Atendimentos recentes</h3><p>Últimos registros disponíveis</p></div><button class="text-button" data-go="Atendimentos">Ver todos '+uiIcon('arrow')+'</button></div>'+history(visits.slice().sort((a,b)=>dataMs(b.data)-dataMs(a.data)).slice(0,5))+'</section>';
}
if(tab==='Painel'&&tutorialAtivo()){html+='<section class="card onboarding-guide"><div><span class="eyebrow">GUIA DE INÍCIO</span><h3>Conheça os principais fluxos do sistema</h3><p>Cadastre o aluno, agende ou registre a consulta, acompanhe a evolução e emita relatórios.</p></div><div class="actions"><button class="btn secondary" data-go="Tutorial">Abrir tutorial</button><button class="btn secondary" id="ocultar-tutorial">Não mostrar novamente</button></div></section>';}
if(tab==='Escolas'){
 if(canManage())html+='<div class="actions"><button class="btn" data-action="escola">+ Cadastrar escola</button><button class="btn secondary" id="seed-schools">Adicionar escolas iniciais</button></div>';
 html+=table(['Instituição','Tipo','INEP','Telefone','Endereço','Ações'],mySchools().map(x=>'<tr><td>'+safe(x.nome)+'</td><td>'+safe(x.tipo==='creche'?'Creche':'Escola')+'</td><td>'+safe(x.inep)+'</td><td>'+safe(x.telefone)+'</td><td>'+safe(x.endereco)+'</td><td>'+(canManage()?'<button class="btn secondary" data-edit-escola="'+safe(x.id)+'">Editar</button>':'—')+'</td></tr>'));
 if(!cache.escolas.length&&canManage())html+='<div class="alert">Cadastre as escolas. Os nomes iniciais sugeridos estão disponíveis no formulário.</div>';
}
if(tab==='Tutorial')html=tutorialSistema();
if(tab==='Profissionais'){
 if(canManage()||profile.perfil==='secretaria'){
  if(canManage())html+='<div class="actions"><button class="btn" data-action="profissional">+ Cadastrar especialista</button><button class="btn secondary" data-action="vinculo">+ Adicionar vínculo de atendimento</button></div>';
  const pessoas=montarListaProfissionais(cache.servidores,cache.profissionais,cache.vinculos,cache.escolas);
  html+='<div class="card"><p>O quadro de servidores escolares também aparece nesta lista. Isso não concede automaticamente acesso ao sistema: a liberação depende de uma ficha profissional, vínculo ativo, horários e conta Google aprovada.</p>'+
   '<div class="grid"><div class="metric"><span>Servidores importados</span><b>'+cache.servidores.length+'</b></div><div class="metric"><span>Fichas de especialistas</span><b>'+cache.profissionais.length+'</b></div><div class="metric"><span>Vínculos ativos</span><b>'+cache.vinculos.filter(v=>v.ativo===true).length+'</b></div></div>'+
   '<label>Buscar servidor ou profissional<input id="busca-profissionais" type="search" placeholder="Pesquisar nome, cargo ou escola"></label>'+
   '<label>Filtrar instituição<select id="filtro-escola-profissionais"><option value="">Todas as escolas</option>'+cache.escolas.map(e=>'<option value="'+safe(e.id)+'">'+safe(e.nome)+'</option>').join('')+'</select></label></div>';
  html+=table(['Nome','Cargo ou especialidade','Escola / atendimento','Situação','Ação'],pessoas.map(p=>{
   const escolas=p.vinculos.map(v=>schoolName(v.escola_id)+' · '+v.cargo+' ('+v.jornada+')');
   if(p.escola_id&&!escolas.includes(schoolName(p.escola_id)))escolas.unshift(schoolName(p.escola_id));
   const situacao=p.habilitado?'Vínculo de atendimento ativo':p.profissional_id?'Ficha profissional sem vínculo':'Servidor escolar — sem habilitação';
   const acao=p.origem==='servidor'&&!p.profissional_id?'<button class="btn secondary" data-configurar-servidor="'+safe(p.id)+'">Criar ficha de especialista</button>':'—';
   return '<tr data-profissional-item data-escola="'+safe(p.escola_id)+'" data-pesquisa="'+safe((p.nome+' '+p.cargo+' '+p.especialidade+' '+escolas.join(' ')).toLowerCase())+'">'+
    '<td>'+safe(p.nome)+(p.vinculos[0]?.uid?' <button class="btn secondary" data-agenda-profissional="'+safe(p.vinculos[0].uid)+'">Ver agenda</button>':'')+'</td><td>'+safe(p.especialidade||p.cargo||'Não informado')+'</td><td>'+safe(escolas.join(' / ')||'Não vinculada')+'</td><td>'+safe(situacao)+'</td><td>'+acao+'</td></tr>';
  }));
 }else{
  html+='<div class="card"><p>As fichas profissionais e o quadro de servidores são gerenciados pela Secretaria de Educação.</p></div>';
 }
}
if(tab==='Profissionais'&&canManage()){
 html+='<h3>Locais e vínculos de acompanhamento</h3><p>Redefinir local encerra o vínculo anterior e cria um novo. O histórico permanece na escola de origem.</p>';
 html+=table(['Profissional','Local','Cargo / jornada','Situação','Ações'],cache.vinculos.map(v=>'<tr><td>'+safe(cache.profissionais.find(p=>p.id===v.profissional_id)?.nome||v.uid)+'</td><td>'+safe(schoolName(v.escola_id))+'</td><td>'+safe(v.cargo)+' · '+safe(v.jornada)+'</td><td>'+safe(v.ativo?'Ativo':'Encerrado')+'</td><td>'+(v.ativo?'<button class="btn secondary" data-redefinir-vinculo="'+safe(v.id)+'">Redefinir local / jornada</button> <button class="btn secondary" data-remover-vinculo="'+safe(v.id)+'">Retirar do acompanhamento</button>':'Histórico preservado')+'</td></tr>'));
}
if(tab==='Servidores'&&canManage()){
 html+='<div class="alert">Quadro de servidores da Educação. Estes cadastros não concedem acesso ao sistema nem criam agenda profissional.</div>';
 html+='<div class="actions"><button class="btn" id="importar-servidores">Importar arquivo de servidores (JSON)</button></div>';
 const total=cache.servidores.length;
 html+='<div class="grid"><div class="metric"><span>Servidores cadastrados</span><b>'+total+'</b></div><div class="metric"><span>Creche Wilma Glória</span><b>'+cache.servidores.filter(x=>x.escola_id==='creche-wilma-gloria').length+'</b></div></div>';
 html+=table(['Servidor','Cargo/Função','Instituição','Ano'],cache.servidores.slice().sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(x=>
 '<tr><td>'+safe(x.nome)+'</td><td>'+safe(x.cargo)+'</td><td>'+safe(schoolName(x.escola_id))+'</td><td>'+safe(x.ano)+'</td></tr>'));
}
if(tab==='Alunos'){
 if(canWrite()||canManage())html+='<div class="actions"><button class="btn" data-action="aluno">+ Cadastrar aluno</button>'+(profile.perfil==='superadmin'?'<button class="btn secondary" id="importar-alunos">Importar alunos (JSON)</button>':'')+'</div>';
 html+=table(['Aluno','Nascimento','Escola','Situação','Ações'],students.map(a=>
 '<tr><td>'+safe(a.nome)+'</td><td>'+safe(a.nascimento)+'</td><td>'+safe(schoolName(a.escola_id))+'</td><td>'+safe(a.ativo===false?'Arquivado':'Ativo')+'</td><td>'+
 '<button class="btn secondary" data-student="'+safe(a.id)+'">Ficha / consultas / relatórios</button> '+
 ((canWrite()||canManage())?'<button class="btn secondary" data-edit-aluno="'+safe(a.id)+'">Editar</button> ':'')+
 ((canWrite()||canManage())&&a.ativo!==false?'<button class="btn secondary" data-archive-aluno="'+safe(a.id)+'">Arquivar</button>':'')+(cache.alunos_necessidades.some(n=>n.id===a.id)?' <button class="btn secondary" data-needs-aluno="'+safe(a.id)+'">Acompanhamento</button>':'')+
 '</td></tr>'));
}
if(tab==='Agenda')html+=filtrosConsultasGerais('agenda',cache.agendamentos,filtrosAgenda);
if(tab==='Atendimentos')html+=filtrosConsultasGerais('atendimentos',cache.atendimentos,filtrosAtendimentos);
if(tab==='Agenda'){
 if(canWrite())html+='<div class="actions"><button class="btn" data-action="agendar">+ Agendar consulta</button></div>';
 html+=table(['Data','Aluno','Escola','Profissional','Situação','Ação'],appointments.slice().sort((a,b)=>dataMs(a.inicio)-dataMs(b.inicio)).map(a=>{
  const situacao={agendado:'Agendado',em_atendimento:'Em atendimento',realizado:'Realizado',cancelado:'Cancelado'}[a.status]||a.status||'Sem situação';
  const acao=a.autor_uid===user.uid&&canWrite()&&a.status==='agendado'?'Iniciar consulta':a.autor_uid===user.uid&&canWrite()&&a.status==='em_atendimento'?'Continuar consulta':'Ver detalhes';
  return '<tr><td>'+safe(formatDate(a.inicio))+'</td><td>'+safe(students.find(s=>s.id===a.aluno_id)?.nome||'Aluno')+'</td><td>'+safe(schoolName(a.escola_id))+'</td><td>'+safe(a.autor_nome)+'</td><td><span class="status-pill status-'+safe(a.status)+'">'+safe(situacao)+'</span></td><td><button type="button" class="btn '+(acao==='Iniciar consulta'?'':'secondary')+'" data-abrir-agendamento="'+safe(a.id)+'">'+safe(acao)+'</button></td></tr>';
 }));
}
if(tab==='Atendimentos'){
 if(canWrite())html+='<div class="actions"><button class="btn" data-action="atendimento">+ Registrar consulta sem agendamento</button></div>';
 html+='<div class="card"><h3>Histórico de consultas por aluno</h3><p class="muted">Selecione um aluno para expandir todas as consultas. A evolução é indicada somente quando registrada pela profissional.</p></div>';
 const grupos=agruparConsultasPorAluno(visits,students,cache.agendamentos,cache.revisoes_metas);
 html+=grupos.length?grupos.map(g=>{
  const e=g.resumo.evolucao;
  const aviso=e.avaliacoes?e.avancos+' registro(s) de avanço observado em '+e.avaliacoes+' avaliação(ões)':'Evolução não avaliada nos registros disponíveis';
  return '<details class="card student-history"><summary><div class="student-history-heading"><div class="student-avatar">'+safe(g.aluno.nome.slice(0,1))+'</div><div><strong>'+safe(g.aluno.nome)+'</strong><small>'+safe(schoolName(g.aluno.escola_id))+' · '+g.resumo.consultas+' consulta(s) · '+g.resumo.faltasAluno+' falta(s)</small><small>'+safe(aviso)+'</small></div></div><span class="student-history-arrow">⌄</span></summary><div class="student-history-content"><div class="actions"><button class="btn secondary" data-student="'+safe(g.alunoId)+'">Abrir ficha do aluno</button><button class="btn secondary" data-print-aluno="'+safe(g.alunoId)+'">Imprimir histórico</button></div>'+history(g.consultas)+'</div></details>';
 }).join(''):'<div class="card"><p class="muted">Nenhum atendimento registrado para os filtros selecionados.</p></div>';
}
if(tab==='Frequência'){
 html+='<div class="alert">Registro declaratório de entrada e saída. Os horários devem ser conferidos pela gestão antes de uso em controle funcional oficial.</div>';
 if(canWrite())html+='<div class="actions"><button class="btn" data-action="frequencia">Registrar entrada</button></div>';
 html+=table(['Entrada','Saída','Escola','Profissional','Situação','Ação'],cache.frequencias.slice().sort((a,b)=>(b.entrada?.seconds||0)-(a.entrada?.seconds||0)).map(f=>
 '<tr><td>'+safe(formatDate(f.entrada))+'</td><td>'+safe(formatDate(f.saida))+'</td><td>'+safe(schoolName(f.escola_id))+'</td><td>'+safe(f.uid)+'</td><td>'+safe(f.status)+'</td><td>'+((f.uid===user.uid&&f.status==='aberta')?'<button class="btn secondary" data-exit="'+safe(f.id)+'">Registrar saída</button>':'—')+'</td></tr>'));
}
if(tab==='Relatórios'){
 const f=filtrosRelatorio,schools=mySchools();
 const registros=[...visits,...appointments];
 const profissionais=[...new Map(registros.filter(r=>r.autor_uid).map(r=>[r.autor_uid,r.autor_nome||'Profissional'])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR'));
 const especialidades=[...new Set(registros.map(r=>r.especialidade).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const filtroSelect=(key,label,opcoes)=>'<label>'+label+'<select data-relatorio="'+key+'"><option value="">Todos</option>'+opcoes.map(([id,nome])=>'<option value="'+safe(id)+'" '+(f[key]===id?'selected':'')+'>'+safe(nome)+'</option>').join('')+'</select></label>';
 html+='<div class="card"><div class="grid">'+
  '<label>Data inicial<input type="date" data-relatorio="de" value="'+safe(f.de)+'"></label>'+
  '<label>Data final<input type="date" data-relatorio="ate" value="'+safe(f.ate)+'"></label>'+
  filtroSelect('escola','Instituição',schools.map(e=>[e.id,e.nome]))+
  filtroSelect('aluno','Aluno',students.map(a=>[a.id,a.nome]))+
  filtroSelect('profissional','Profissional',profissionais)+
  filtroSelect('especialidade','Especialidade',especialidades.map(e=>[e,e]))+
  '</div><div class="actions report-actions"><button class="btn secondary" id="limpar-relatorio">Limpar filtros</button><button class="btn" id="imprimir-gerencial">Imprimir relatório / salvar PDF</button></div><p class="muted">O documento segue os filtros escolhidos e será gerado localmente no navegador. Período pelo horário de Brasília.</p></div>';
 if(f.de&&f.ate&&f.de>f.ate){
  html+='<div class="alert" role="alert">A data final deve ser igual ou posterior à inicial.</div>';
 }else{
  const resumo=resumirRelatorio(visits,appointments,f);
  html+=graficosConsultas(filtrarRegistros(visits,f),filtrarRegistros(appointments,f));
  html+='<div class="grid">'+[
   ['Alunos com atendimento realizado',resumo.alunos],
   ['Atendimentos realizados',resumo.realizados],
   ['Agendamentos pendentes',resumo.agendados],
   ['Ausências de alunos',resumo.faltas]
  ].map(([l,n])=>'<div class="metric"><span>'+l+'</span><b>'+n+'</b></div>').join('')+'</div>';
  html+='<h3>Indicadores por instituição</h3>';
  html+=table(['Escola','Alunos atendidos','Atendimentos realizados','Agendados','Ausências de alunos'],schools.filter(e=>!f.escola||e.id===f.escola).map(e=>{
   const r=resumirRelatorio(visits,appointments,{...f,escola:e.id});
   return '<tr><td>'+safe(e.nome)+'</td><td>'+r.alunos+'</td><td>'+r.realizados+'</td><td>'+r.agendados+'</td><td>'+r.faltas+'</td></tr>';
  }));
  const filtrados=filtrarRegistros(visits,f),agendaFiltrada=filtrarRegistros(appointments,f);
  html+='<div class="grid report-summary-grid">'+[
   ['Consultas realizadas',filtrados.filter(x=>x.status==='realizado').length],
   ['Faltas do aluno',agendaFiltrada.filter(x=>x.status==='falta_aluno').length],
   ['Faltas da profissional',agendaFiltrada.filter(x=>x.status==='falta_profissional').length],
   ['Reagendamentos',agendaFiltrada.filter(x=>x.status==='remarcado'||x.novo_agendamento_id).length]
  ].map(([nome,total])=>'<div class="metric"><span>'+safe(nome)+'</span><b>'+total+'</b></div>').join('')+'</div>';
  html+='<h3>Produção por especialidade</h3>';
  const especialidadesAtivas=[...new Set([...filtrados,...agendaFiltrada].map(x=>x.especialidade).filter(Boolean))];
  html+=table(['Especialidade','Consultas realizadas','Agendadas','Faltas'],especialidadesAtivas.map(e=>[
   '<tr><td>'+safe(e)+'</td><td>'+filtrados.filter(x=>x.especialidade===e&&x.status==='realizado').length+'</td><td>'+agendaFiltrada.filter(x=>x.especialidade===e&&x.status==='agendado').length+'</td><td>'+agendaFiltrada.filter(x=>x.especialidade===e&&['falta_aluno','falta_profissional'].includes(x.status)).length+'</td></tr>'
  ][0]));
  html+='<h3>Produção por profissional</h3>';
  const profissionaisAtivos=[...new Map([...filtrados,...agendaFiltrada].filter(x=>x.autor_uid).map(x=>[x.autor_uid,x.autor_nome||x.autor_uid])).entries()];
  html+=table(['Profissional','Realizados','Agendados','Ausências'],profissionaisAtivos.map(([uid,nome])=>
   '<tr><td>'+safe(nome)+'</td><td>'+filtrados.filter(x=>x.autor_uid===uid&&x.status==='realizado').length+'</td><td>'+agendaFiltrada.filter(x=>x.autor_uid===uid&&x.status==='agendado').length+'</td><td>'+agendaFiltrada.filter(x=>x.autor_uid===uid&&['falta_aluno','falta_profissional'].includes(x.status)).length+'</td></tr>'));
  if(!resumo.realizados&&!resumo.agendados&&!resumo.faltas)html+='<p class="muted" role="status">Nenhum atendimento realizado, agendamento pendente ou ausência para os filtros selecionados.</p>';
 }
 html+='<p class="muted">Cada aluno é contado uma vez no total e uma vez por instituição em que foi atendido. Os indicadores apresentam apenas quantidades.</p>';
}
if(tab==='Usuários'&&canManage()){html+='<div class="card"><p>Usuários entram com Google e aguardam aprovação. A Secretaria não recebe nem envia senhas.</p></div>';html+=table(['Usuário','E-mail','Perfil','Situação','Ação'],cache.usuarios.map(u=>'<tr><td>'+safe(u.nome)+'</td><td>'+safe(u.email)+'</td><td>'+safe(u.perfil)+'</td><td>'+safe(u.ativo?'Ativo':'Pendente')+'</td><td>'+(u.perfil==='superadmin'?'Protegido':'<button class="btn secondary" data-user="'+safe(u.id)+'">Permissões</button>')+'</td></tr>'))}
if(tab==='Ficha do aluno')html=title('Ficha do aluno','Consultas, acompanhamento e relatórios individuais')+fichaAluno();
layout(html);document.querySelectorAll('[data-print-aluno]').forEach(b=>b.onclick=()=>imprimirAluno(b.dataset.printAluno));const imprimG=document.getElementById('imprimir-gerencial');if(imprimG)imprimG.onclick=imprimirGerencial;const tutorialToggle=document.getElementById('alternar-tutorial');if(tutorialToggle)tutorialToggle.onclick=alternarTutorial;const introOff=document.getElementById('ocultar-tutorial');if(introOff)introOff.onclick=alternarTutorial;document.querySelectorAll('[data-abrir-agendamento]').forEach(b=>b.onclick=()=>abrirAgendamento(b.dataset.abrirAgendamento));document.querySelectorAll('[data-go]').forEach(el=>el.onclick=()=>{tab=el.dataset.go;render()});const novaMeta=document.getElementById('nova-meta');if(novaMeta)novaMeta.onclick=()=>definirMeta();document.querySelectorAll('[data-evolucao-meta]').forEach(b=>b.onclick=()=>registrarEvolucao(b.dataset.evolucaoMeta));document.querySelectorAll('[data-redefinir-meta]').forEach(b=>b.onclick=()=>definirMeta(b.dataset.redefinirMeta));document.querySelectorAll('[data-consulta-geral]').forEach(el=>el.onchange=()=>{const filtros=el.dataset.grupo==='agenda'?filtrosAgenda:filtrosAtendimentos;filtros[el.dataset.consultaGeral]=el.value;const de=filtros.de,ate=filtros.ate;if(de&&ate&&de>ate){filtros[el.dataset.consultaGeral]='';showError(Error('A data final deve ser igual ou posterior à inicial.'))}render()});document.querySelectorAll('[data-limpar-consultas]').forEach(el=>el.onclick=()=>{if(el.dataset.limparConsultas==='agenda')filtrosAgenda={};else filtrosAtendimentos={};render()});document.querySelectorAll('[data-agenda-profissional]').forEach(el=>el.onclick=()=>{filtrosAgenda={profissional:el.dataset.agendaProfissional};tab='Agenda';render()});document.querySelectorAll('[data-redefinir-vinculo]').forEach(el=>el.onclick=()=>redefinirVinculo(el.dataset.redefinirVinculo));document.querySelectorAll('[data-remover-vinculo]').forEach(el=>el.onclick=()=>removerVinculo(el.dataset.removerVinculo));document.querySelectorAll('[data-consulta]').forEach(el=>el.onchange=()=>{filtrosConsulta[el.dataset.consulta]=el.value;render()});const limparConsultas=document.getElementById('limpar-consultas');if(limparConsultas)limparConsultas.onclick=()=>{filtrosConsulta={};render()};const voltarAlunos=document.getElementById('voltar-alunos');if(voltarAlunos)voltarAlunos.onclick=()=>{tab='Alunos';render()};const novoRelatorio=document.getElementById('novo-relatorio-aluno');if(novoRelatorio)novoRelatorio.onclick=novoRelatorioAluno;document.querySelectorAll('[data-relatorio]').forEach(el=>el.onchange=()=>{filtrosRelatorio[el.dataset.relatorio]=el.value;render()});const limparRelatorio=document.getElementById('limpar-relatorio');if(limparRelatorio)limparRelatorio.onclick=()=>{filtrosRelatorio={de:'',ate:'',escola:'',profissional:'',especialidade:''};render()};document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>openForm(b.dataset.action));document.querySelectorAll('[data-student]').forEach(b=>b.onclick=()=>{alunoSelecionado=b.dataset.student;filtrosConsulta={};tab='Ficha do aluno';render()});document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));document.querySelectorAll('[data-user]').forEach(b=>b.onclick=()=>openUser(b.dataset.user));document.querySelectorAll('[data-exit]').forEach(b=>b.onclick=()=>registerExit(b.dataset.exit));document.querySelectorAll('[data-edit-aluno]').forEach(b=>b.onclick=()=>editStudent(b.dataset.editAluno));document.querySelectorAll('[data-edit-escola]').forEach(b=>b.onclick=()=>editSchool(b.dataset.editEscola));document.querySelectorAll('[data-archive-aluno]').forEach(b=>b.onclick=()=>archiveStudent(b.dataset.archiveAluno));document.querySelectorAll('[data-cancel-agenda]').forEach(b=>b.onclick=()=>cancelarAgendamento(b.dataset.cancelAgenda));document.querySelectorAll('[data-needs-aluno]').forEach(b=>b.onclick=()=>mostrarAcompanhamento(b.dataset.needsAluno));const seed=document.getElementById('seed-schools');if(seed)seed.onclick=seedSchools;const importador=document.getElementById('importar-servidores');if(importador)importador.onclick=abrirImportadorServidores;const btnAlunos=document.getElementById('importar-alunos');if(btnAlunos)btnAlunos.onclick=abrirImportadorAlunos;document.querySelectorAll('[data-configurar-servidor]').forEach(b=>b.onclick=()=>configurarServidorComoEspecialista(b.dataset.configurarServidor));const procurar=document.getElementById('busca-profissionais'),escolaFiltro=document.getElementById('filtro-escola-profissionais');const filtrarProfissionais=()=>{const termo=(procurar?.value||'').toLocaleLowerCase('pt-BR').trim(),escola=escolaFiltro?.value||'';document.querySelectorAll('[data-profissional-item]').forEach(el=>{el.hidden=!!((termo&&!el.dataset.pesquisa.includes(termo))||(escola&&el.dataset.escola!==escola))})};if(procurar)procurar.oninput=filtrarProfissionais;if(escolaFiltro)escolaFiltro.onchange=filtrarProfissionais}


function painelResumoAluno(alunoId){
 const r=resumirAluno(alunoId,cache.atendimentos,cache.agendamentos,cache.revisoes_metas);
 const ev=r.evolucao;
 return '<div class="card student-summary"><div class="section-heading"><div><h2>Resumo do acompanhamento</h2><p>Calculado a partir do histórico disponível.</p></div></div>'+
 '<div class="summary-stats"><div><strong>'+r.consultas+'</strong><span>Consultas realizadas</span></div><div><strong>'+r.faltasAluno+'</strong><span>Faltas do aluno</span></div><div><strong>'+r.remarcados+'</strong><span>Remarcações</span></div><div><strong>'+ev.avaliacoes+'</strong><span>Avaliações registradas</span></div></div>'+
 '<p><strong>Profissionais:</strong> '+safe(r.profissionais.join(', ')||'Ainda não registrados')+'</p>'+
 '<p><strong>Especialidades:</strong> '+safe(r.especialidades.join(', ')||'Não registradas')+'</p>'+
 '<p><strong>Primeira consulta:</strong> '+safe(formatDate(r.primeiraConsulta))+' · <strong>Última consulta:</strong> '+safe(formatDate(r.ultimaConsulta))+'</p>'+
 '<div class="summary-evolution"><h3>Evolução documentada</h3><p>Avanço observado: <b>'+ev.avancos+'</b> · Sem mudança observada: <b>'+ev.semMudanca+'</b> · Reavaliação indicada: <b>'+ev.reavaliacao+'</b> · Revisões de metas: <b>'+ev.revisoes+'</b>.</p><p class="muted">'+safe(ev.descricao)+'</p></div></div>';
}
function tutorialAtivo(){
 try{return localStorage.getItem('seduc-tutorial-oculto')!=='1'}catch{return true}
}
function alternarTutorial(){
 try{localStorage.setItem('seduc-tutorial-oculto',tutorialAtivo()?'1':'0')}catch{}
 render();
}
function imprimirDocumento(html){
 const popup=window.open('','_blank');
 if(!popup){showError(Error('O navegador bloqueou a janela de impressão. Autorize pop-ups para este site e tente novamente.'));return}
 popup.document.open();popup.document.write(html);popup.document.close();popup.focus();
}
function imprimirAluno(alunoId){
 const aluno=cache.alunos.find(a=>a.id===alunoId);
 if(!aluno){showError(Error('Aluno não disponível para sua conta.'));return}
 if(!confirm('O documento contém dados pessoais escolares. Confirme que utilizará a impressão em ambiente autorizado.'))return;
 const podeLerNotas=['especialista','superadmin'].includes(profile.perfil);
 imprimirDocumento(montarDocumentoAluno({
  aluno,atendimentos:cache.atendimentos,agendamentos:cache.agendamentos,revisoes:cache.revisoes_metas,
  relatorios:podeLerNotas?cache.relatorios_alunos:[],
  emissor:profile.nome||user.email,escola:schoolName(aluno.escola_id),incluirNotas:podeLerNotas
 }));
}
function imprimirGerencial(){
 const f=filtrosRelatorio;
 if(f.de&&f.ate&&f.de>f.ate){showError(Error('Corrija o período do relatório.'));return}
 const visitas=filtrarRegistros(cache.atendimentos,f);
 const agenda=filtrarRegistros(cache.agendamentos,f);
 imprimirDocumento(montarDocumentoGerencial({
  atendimentos:visitas,agendamentos:agenda,escolas:mySchools(),
  emissor:profile.nome||user.email,
  referencia:[f.de||'Início',f.ate||'Até hoje',f.escola?schoolName(f.escola):'Todas as escolas',f.especialidade||'Todas as especialidades'].join(' · ')
 }));
}

function fichaAluno(){
 const aluno=cache.alunos.find(a=>a.id===alunoSelecionado);
 if(!aluno)return '<div class="alert">Aluno não disponível para esta conta.</div>';
 const f=filtrosConsulta,registros=[...cache.atendimentos,...cache.agendamentos].filter(r=>r.aluno_id===aluno.id);
 const opcoes=(chave,label,lista)=>'<label>'+label+'<select data-consulta="'+chave+'"><option value="">Todos</option>'+lista.map(([id,nome])=>'<option value="'+safe(id)+'" '+(f[chave]===id?'selected':'')+'>'+safe(nome)+'</option>').join('')+'</select></label>';
 const profissionais=[...new Map(registros.filter(r=>r.autor_uid).map(r=>[r.autor_uid,r.autor_nome||'Profissional'])).entries()];
 const especialidades=[...new Set(registros.map(r=>r.especialidade).filter(Boolean))].map(s=>[s,s]);
 let html='<div class="actions"><button class="btn secondary" id="voltar-alunos">Voltar aos alunos</button><button class="btn" data-print-aluno="'+safe(aluno.id)+'">Imprimir relatório individual</button></div><div class="card"><h2>'+safe(aluno.nome)+'</h2><p>'+safe(schoolName(aluno.escola_id))+' · '+safe(aluno.ativo===false?'Arquivado':'Ativo')+'</p></div>'+painelResumoAluno(aluno.id);
 html+='<h2>Consultas e atendimentos</h2><div class="card"><div class="grid">'+
  '<label>Data inicial<input type="date" data-consulta="de" value="'+safe(f.de)+'"></label>'+
  '<label>Data final<input type="date" data-consulta="ate" value="'+safe(f.ate)+'"></label>'+
  opcoes('profissional','Profissional',profissionais)+opcoes('especialidade','Especialidade',especialidades)+
  opcoes('status','Situação',[['agendado','Agendado'],['em_atendimento','Em atendimento'],['realizado','Realizado'],['cancelado','Cancelado'],['remarcado','Remarcado'],['falta_aluno','Falta do aluno'],['falta_profissional','Falta do profissional']])+
  opcoes('tipo','Tipo',[['agendamento','Consulta agendada'],['atendimento','Atendimento registrado']])+
  '</div><button class="btn secondary" id="limpar-consultas">Limpar filtros</button></div>';
 if(f.de&&f.ate&&f.de>f.ate)html+='<div class="alert" role="alert">A data final deve ser igual ou posterior à inicial.</div>';
 else{
  const lista=consultasDoAluno(aluno.id,cache.atendimentos,cache.agendamentos,f);
  html+=graficosConsultas(lista.filter(r=>r.tipo==='atendimento'),lista.filter(r=>r.tipo==='agendamento'));
  html+='<p role="status">'+lista.length+' registro(s) encontrado(s). Datas pelo horário de Brasília.</p><div class="card">'+(lista.length?lista.map(r=>r.tipo==='atendimento'?history([r]):'<details class="history"><summary>Consulta · '+safe(formatDate(r.inicio))+' · '+safe(r.autor_nome)+' <span class="badge">'+safe(r.status)+'</span></summary><p>'+safe(r.especialidade)+' · '+safe(r.duracao_min)+' minutos</p></details>').join(''):'<p class="muted">Nenhuma consulta para os filtros selecionados.</p>')+'</div>';
 }
 html+=painelMetas(aluno);
 html+='<h2>Relatórios do aluno</h2><p>Os relatórios permanecem nesta ficha, identificados pela profissional e data de emissão.</p>';
 if(canWrite()&&aluno.ativo!==false)html+='<button class="btn" id="novo-relatorio-aluno">+ Escrever relatório</button>';
 if(erroRelatorios)html+='<div class="alert" role="alert">Não foi possível carregar os relatórios. Verifique as permissões e a publicação das regras do Firestore.</div>';
 const relatorios=cache.relatorios_alunos.filter(r=>r.aluno_id===aluno.id).sort((a,b)=>dataMs(b.criado_em)-dataMs(a.criado_em));
 html+='<div class="card">'+(relatorios.length?relatorios.map(r=>'<details class="history"><summary><b>'+safe(r.titulo)+'</b> · '+safe(formatDate(r.criado_em))+' · '+safe(r.autor_nome)+'</summary><p>'+safe(r.especialidade)+'</p><p style="white-space:pre-wrap">'+safe(r.texto)+'</p></details>').join(''):'<p class="muted">Nenhum relatório disponível nesta ficha.</p>')+'</div>';
 return html;
}
function novoRelatorioAluno(){
 const aluno=cache.alunos.find(a=>a.id===alunoSelecionado);
 if(!canWrite()||!aluno||aluno.ativo===false)return;
 const vinculos=cache.vinculos.filter(v=>v.uid===user.uid&&v.escola_id===aluno.escola_id&&v.ativo===true);
 if(!vinculos.length){alert('É necessário um vínculo ativo na escola do aluno.');return}
 modal('Relatório de acompanhamento — '+safe(aluno.nome),
  select('vinculo_id','Vínculo profissional',vinculos.map(v=>[v.id,v.cargo+' · '+v.jornada]))+
  field('especialidade','Especialidade','text','required maxlength="150"')+
  field('titulo','Título do relatório','text','required maxlength="150"')+
  '<label class="wide">Relatório de acompanhamento<textarea name="texto" required maxlength="5000"></textarea></label><p class="wide muted">O relatório será salvo nesta ficha com sua autoria e data. Para complementá-lo depois, emita um novo relatório.</p>',
  async d=>{
   const conteudo=validarRelatorio(d);
   await addDoc(collection(db,'relatorios_alunos'),{...conteudo,aluno_id:aluno.id,escola_id:aluno.escola_id,
    vinculo_id:d.vinculo_id,especialidade:d.especialidade.trim(),autor_uid:user.uid,
    autor_nome:profile.nome||user.displayName||'Profissional',criado_em:serverTimestamp()});
  });
}


function filtrosConsultasGerais(grupo,registros,f){
 const profissionais=[...new Map([...cache.vinculos.filter(v=>v.uid).map(v=>[v.uid,cache.profissionais.find(p=>p.id===v.profissional_id)?.nome||professionalName(v.uid)]),...registros.filter(r=>r.autor_uid).map(r=>[r.autor_uid,r.autor_nome||professionalName(r.autor_uid)])]).entries()];
 const atributo=key=>'data-consulta-geral="'+key+'" data-grupo="'+grupo+'"';
 const selectFiltro=(key,label,opcoes)=>'<label>'+label+'<select '+atributo(key)+'><option value="">Todos</option>'+opcoes.map(([id,nome])=>'<option value="'+safe(id)+'" '+(f[key]===id?'selected':'')+'>'+safe(nome)+'</option>').join('')+'</select></label>';
 return '<div class="card"><h3>Filtrar consultas</h3><div class="grid"><label>Nome do aluno<input type="search" '+atributo('nome')+' value="'+safe(f.nome||'')+'" placeholder="Pesquisar aluno"></label>'+
 selectFiltro('profissional','Profissional',profissionais)+selectFiltro('escola','Local',mySchools().map(s=>[s.id,s.nome]))+
 '<label>Data inicial<input type="date" '+atributo('de')+' value="'+safe(f.de||'')+'"></label><label>Data final<input type="date" '+atributo('ate')+' value="'+safe(f.ate||'')+'"></label>'+
 selectFiltro('status','Situação',[['agendado','Agendado'],['em_atendimento','Em atendimento'],['realizado','Realizado'],['cancelado','Cancelado'],['remarcado','Remarcado'],['falta_aluno','Falta do aluno'],['falta_profissional','Falta do profissional']])+
 '</div><p class="muted">Para consultar um único dia, selecione a mesma data no início e no fim. O período usa o horário de Brasília.</p><button class="btn secondary" data-limpar-consultas="'+grupo+'">Limpar filtros</button></div>';
}
async function removerVinculo(id){
 if(!canManage())return;
 const v=cache.vinculos.find(v=>v.id===id&&v.ativo===true);if(!v)return;
 if(!confirm('Retirar este vínculo de acompanhamento? Consultas e relatórios anteriores serão preservados. Agendamentos futuros precisarão ser revistos na agenda.'))return;
 try{await updateDoc(doc(db,'vinculos',id),{ativo:false});await refresh();render()}catch(e){showError(e)}
}
function redefinirVinculo(id){
 if(!canManage())return;
 const v=cache.vinculos.find(v=>v.id===id&&v.ativo===true);if(!v)return;
 modal('Redefinir local e jornada',schoolSelect()+field('cargo','Cargo / função','text','required')+
 field('jornada','Jornada semanal','text','required')+field('horarios_texto','Dias e horários (ex.: 1 08:00-12:00)','text','required')+
 '<p class="wide muted">O vínculo anterior será encerrado. Consultas já agendadas permanecem no local original e devem ser revistas pela equipe.</p>',
 async d=>{
  const horarios=lerHorarios(d.horarios_texto),batch=writeBatch(db);
  batch.update(doc(db,'vinculos',v.id),{ativo:false});
  batch.set(doc(collection(db,'vinculos')),{profissional_id:v.profissional_id,uid:v.uid,escola_id:d.escola_id,cargo:d.cargo,jornada:d.jornada,horarios,slots_semana:gerarSlotsSemana(horarios),ativo:true});
  await batch.commit();
 });
 const form=document.getElementById('entry');
 form.elements.namedItem('escola_id').value=v.escola_id;
 form.elements.namedItem('cargo').value=v.cargo||'';
 form.elements.namedItem('jornada').value=v.jornada||'';
 form.elements.namedItem('horarios_texto').value=(v.horarios||[]).map(h=>h.dia+' '+h.inicio+'-'+h.fim).join('; ');
}


function graficoBarras(titulo,dados){
 if(!dados.length)return '<div class="card"><h3>'+safe(titulo)+'</h3><p class="muted">Sem registros para esta seleção.</p></div>';
 const max=Math.max(1,...dados.map(d=>d.total));
 return '<div class="card"><h3>'+safe(titulo)+'</h3><table><caption class="muted">Quantidade de registros</caption><tbody>'+dados.map(d=>'<tr><th scope="row">'+safe(d.rotulo)+'</th><td><meter min="0" max="'+max+'" value="'+d.total+'" aria-label="'+safe(d.rotulo)+'">'+d.total+'</meter> <b>'+d.total+'</b></td></tr>').join('')+'</tbody></table></div>';
}
function graficosConsultas(atendimentos,agendamentos){
 const i=indicadoresConsultas(atendimentos,agendamentos);
 return '<p class="muted">Gráficos de atendimentos realizados. A quantidade de consultas não mede, por si só, o desenvolvimento do aluno.</p><div class="grid">'+graficoBarras('Atendimentos por mês (meses com registros)',i.meses)+graficoBarras('Atendimentos por especialidade',i.especialidades)+graficoBarras('Atendimentos por profissional',i.profissionais)+'</div>';
}
function painelMetas(aluno){
 const metas=cache.metas_alunos.filter(m=>m.aluno_id===aluno.id);
 const revisoes=cache.revisoes_metas.filter(r=>r.aluno_id===aluno.id);
 const analise=analisarAcompanhamento(metas,revisoes,cache.agendamentos.filter(r=>r.aluno_id===aluno.id));
 let html='<h2>Metas individuais e evolução</h2><p>Metas definidas pela Secretaria e equipe. A situação é registrada por uma pessoa responsável, com evidências.</p>';
 if(erroMetas)html+='<div class="alert">Não foi possível carregar as metas. Confira a publicação das regras e as permissões.</div>';
 if((canManage()||canWrite())&&aluno.ativo!==false)html+='<button class="btn" id="nova-meta">+ Definir meta individual</button>';
 html+=graficoBarras('Situação das metas atuais',analise.estados);
 html+='<div class="card"><h3>Apoio ao acompanhamento</h3><p class="muted">Análise automática de pendências pelos dados registrados. Não produz diagnóstico clínico.</p><ul>'+analise.alertas.map(a=>'<li>'+safe(a)+'</li>').join('')+'</ul></div>';
 for(const m of analise.metas){
  html+='<details class="history"><summary><b>'+safe(m.titulo)+'</b> · '+safe(estadosMeta[m.status])+'</summary><p><b>Ponto de partida:</b> '+safe(m.linha_base)+'</p><p><b>Critério de alcance:</b> '+safe(m.criterio)+'</p><p><b>Revisão prevista:</b> '+safe(formatDate(m.prazo))+'</p><p>Definida por '+safe(m.autor_nome)+' em '+safe(formatDate(m.criado_em))+'</p>';
  if((canManage()||canWrite())&&aluno.ativo!==false)html+='<div class="actions"><button class="btn secondary" data-evolucao-meta="'+safe(m.id)+'">Registrar evolução</button><button class="btn secondary" data-redefinir-meta="'+safe(m.id)+'">Redefinir meta</button></div>';
  html+=(m.revisoes.length?m.revisoes.map(r=>'<div class="card"><b>'+safe(estadosMeta[r.status])+'</b> · '+safe(r.autor_nome)+' · '+safe(formatDate(r.criado_em))+'<p style="white-space:pre-wrap">'+safe(r.evidencia)+'</p></div>').join(''):'<p class="muted">Aguardando primeiro registro de evolução.</p>')+'</details>';
 }
 const anteriores=metas.filter(m=>!analise.metas.some(a=>a.id===m.id));
 if(anteriores.length)html+='<details class="history"><summary>Metas anteriores e histórico preservado ('+anteriores.length+')</summary>'+anteriores.map(m=>'<h4>'+safe(m.titulo)+'</h4><p>'+safe(m.linha_base)+' — '+safe(m.criterio)+'</p>'+revisoes.filter(r=>r.meta_id===m.id).map(r=>'<p>'+safe(formatDate(r.criado_em))+' · '+safe(r.autor_nome)+' · '+safe(estadosMeta[r.status])+': '+safe(r.evidencia)+'</p>').join('')).join('')+'</details>';
 return html;
}
function vinculoParaMeta(aluno){
 return cache.vinculos.find(v=>v.escola_id===aluno.escola_id&&v.uid===user.uid&&v.ativo===true)?.id||'';
}
function definirMeta(anteriorId=''){
 const aluno=cache.alunos.find(a=>a.id===alunoSelecionado);
 if(!aluno||aluno.ativo===false||!(canManage()||canWrite()))return;
 const vinculo=vinculoParaMeta(aluno);
 if(!canManage()&&!vinculo){alert('É necessário um vínculo ativo na escola.');return}
 const anterior=cache.metas_alunos.find(m=>m.id===anteriorId&&m.aluno_id===aluno.id);
 modal(anterior?'Redefinir meta individual':'Definir meta individual',
 field('titulo','Objetivo individual','text','required maxlength="150"')+
 '<label class="wide">Ponto de partida observado<textarea name="linha_base" required maxlength="1000"></textarea></label>'+
 '<label class="wide">Como verificar que a meta foi alcançada<textarea name="criterio" required maxlength="1000"></textarea></label>'+
 field('prazo','Data prevista para revisão','date','required')+
 '<p class="wide muted">Descreva comportamentos observáveis e apoios necessários. O critério é individual; não é uma pontuação automática de diagnóstico.</p>',
 async d=>{const dados=validarMeta({...d,prazo:d.prazo+'T12:00:00-03:00'});
 await addDoc(collection(db,'metas_alunos'),{...dados,aluno_id:aluno.id,escola_id:aluno.escola_id,vinculo_id:vinculo,
  substitui_id:anterior?.id||'',autor_uid:user.uid,autor_nome:profile.nome,criado_em:serverTimestamp()});
 });
 if(anterior){const form=document.getElementById('entry');for(const k of ['titulo','linha_base','criterio'])form.elements.namedItem(k).value=anterior[k];}
}
function registrarEvolucao(metaId){
 const meta=cache.metas_alunos.find(m=>m.id===metaId),aluno=cache.alunos.find(a=>a.id===meta?.aluno_id);
 if(!meta||!aluno||aluno.ativo===false||!(canManage()||canWrite()))return;
 const vinculo=vinculoParaMeta(aluno);
 if(!canManage()&&!vinculo){alert('É necessário um vínculo ativo na escola.');return}
 modal('Evolução da meta — '+safe(meta.titulo),select('status','Situação observada',Object.entries(estadosMeta))+
 '<label class="wide">Evidências observadas e próximos passos<textarea name="evidencia" required maxlength="2000"></textarea></label>',
 async d=>{
  if(!d.evidencia.trim())throw Error('Registre as evidências observadas.');
  await addDoc(collection(db,'revisoes_metas'),{meta_id:meta.id,aluno_id:aluno.id,escola_id:aluno.escola_id,vinculo_id:vinculo,
   status:d.status,evidencia:d.evidencia.trim(),autor_uid:user.uid,autor_nome:profile.nome,criado_em:serverTimestamp()});
 });
}
function tutorialSistema(){
 return title('Tutorial e acompanhamento','Um roteiro de trabalho para a equipe e a Secretaria')+
 '<div class="card tutorial-settings"><h2>Guia de orientação</h2><p>O guia pode ser ocultado no painel inicial a qualquer momento. Ele continuará disponível neste menu.</p><button class="btn secondary" id="alternar-tutorial">'+(tutorialAtivo()?'Desativar guia do painel':'Ativar guia do painel')+'</button></div>'+
 '<div class="card privacy-tutorial"><h2>LGPD e segurança da informação</h2><p>O acesso é individual e restrito às atividades profissionais. A leitura e ciência dos Termos de Uso são solicitadas em cada login.</p>'+textoAvisoSeguranca()+'</div>'+ 
 '<div class="card"><h2>Consulta sem agendamento</h2><p>Acesse Atendimentos e escolha Registrar consulta sem agendamento. Informe escola, aluno, data, especialidade, atividades, observações e a classificação da evolução feita pela profissional.</p></div>'+
 '<div class="card"><h2>Agendamento, faltas e reagendamento</h2><p>Abra um agendamento para iniciar a consulta, marcar falta ou reagendar com nova data e motivo. Os registros anteriores ficam preservados, inclusive o motivo da ausência.</p></div>'+
 '<div class="card"><h2>Histórico e impressão</h2><p>O histórico agrupa consultas por aluno. Expanda cada consulta para visualizar os detalhes. Na ficha individual ou no menu Relatórios, use Imprimir para gerar um documento A4 ou salvar como PDF pelo navegador.</p></div>'+
 '<div class="card"><h2>1. Organizar a equipe e a agenda</h2><p>A Secretaria com gestão cadastra profissionais e vínculos, define escola/local e jornada. Em Profissionais, use Ver agenda. Consulte por profissional, aluno e período antes de marcar uma consulta.</p></div>'+
 '<div class="card"><h2>2. Conhecer o ponto de partida de cada aluno</h2><p>Abra Alunos → Ficha / consultas / relatórios. Consulte os registros anteriores e descreva observações contextualizadas, os apoios utilizados e as necessidades identificadas pela equipe.</p></div>'+
 '<div class="card"><h2>3. Definir uma meta individual verificável</h2><p>A Secretaria e as especialistas podem definir metas na ficha do aluno. Registre o ponto de partida, o objetivo, o critério observável de alcance e uma data de revisão. Combine esses critérios com a equipe e, quando pertinente, com a família.</p><p>Exemplo de estrutura: em determinada atividade e com os apoios combinados, observar a habilidade escolhida em situações que a equipe tenha definido como suficientes. A equipe preenche a habilidade, os apoios e os critérios; o sistema não impõe marcos universais.</p></div>'+
 '<div class="card"><h2>4. Atender e registrar evidências</h2><p>Registre o atendimento e depois a evolução das metas na ficha. Descreva o que foi observado, em qual contexto, com quais apoios e quais próximos passos foram combinados. A situação pode ser Definida, Em desenvolvimento, Atingida ou Requer revisão.</p></div>'+
 '<div class="card"><h2>5. Rever o plano e emitir relatórios</h2><p>Compare os registros com o critério individual. Se necessário, redefina a meta: a versão e as evidências anteriores ficam preservadas. Emita o relatório de acompanhamento na própria ficha e confira sua autoria e data. Os gráficos mostram consultas e estados registrados das metas; não comprovam causalidade nem geram diagnóstico.</p></div>'+
 '<div class="card"><h2>Apoio inteligente e responsabilidade profissional</h2><p>Os alertas atuais são análises automáticas explicáveis de prazos, ausência de revisões e faltas registradas. Cada alerta deve ser conferido pela equipe. A interpretação de desenvolvimento, a escolha de intervenções e qualquer diagnóstico cabem às profissionais habilitadas; o sistema não substitui avaliação clínica.</p><p>Referência de supervisão humana: <a href="https://www.unesco.org/en/legal-affairs/recommendation-ethics-artificial-intelligence" target="_blank" rel="noopener">Recomendação da UNESCO sobre ética da inteligência artificial</a>.</p></div>';
}

function history(records){return records.length?records.map(a=>'<details class="history" data-visit="'+safe(a.id)+'"><summary><b>'+safe(cache.alunos.find(s=>s.id===a.aluno_id)?.nome||'Aluno')+'</b> · '+safe(formatDate(a.data))+' · '+safe(a.autor_nome||professionalName(a.autor_uid))+' <span class="badge">'+safe(a.status||'realizado')+'</span></summary><p style="white-space:pre-wrap">'+((profile.perfil==='especialista'||profile.perfil==='superadmin')?safe(a.texto):'<em>Observações restritas aos especialistas autorizados.</em>')+'</p><small>'+safe(a.especialidade||'Atendimento especializado')+(a.agendamento_id?' · Originado de agendamento':'')+'</small>'+(a.autor_uid===user.uid||profile.perfil==='superadmin'?'<p><button class="btn secondary" data-edit="'+safe(a.id)+'">Editar / cancelar</button></p>':'')+'</details>').join(''):'<p class="muted">Ainda não há atendimentos registrados.</p>'}
function field(name,label,type='text',extra=''){return '<label>'+label+'<input name="'+name+'" type="'+type+'" '+extra+'></label>'}
function select(name,label,options){return '<label>'+label+'<select name="'+name+'" required><option value="">Selecione</option>'+options.map(([id,n])=>'<option value="'+safe(id)+'">'+safe(n)+'</option>').join('')+'</select></label>'}
function schoolSelect(){return select('escola_id','Escola',mySchools().map(s=>[s.id,s.nome]))}
function seletorAlunoPesquisavel(){
 return '<div class="wide aluno-search-widget" data-aluno-picker>'+
 '<label for="pesquisa-aluno-agenda">Pesquisar aluno cadastrado</label>'+
 '<input id="pesquisa-aluno-agenda" type="search" autocomplete="off" placeholder="Selecione a escola para buscar pelo nome ou matrícula" disabled aria-describedby="aluno-search-feedback">'+
 '<input type="hidden" name="aluno_id" value="">'+
 '<div id="aluno-search-selecionado" class="aluno-search-selecionado" role="status" hidden></div>'+
 '<p id="aluno-search-feedback" class="muted" aria-live="polite">Selecione a escola para pesquisar os alunos cadastrados.</p>'+
 '<div id="aluno-search-resultados" class="aluno-search-resultados" aria-label="Alunos encontrados"></div>'+
 '</div>';
}
function ativarBuscaAlunosDoFormulario(){
 const form=document.getElementById('entry'),picker=form?.querySelector('[data-aluno-picker]');
 if(!picker)return;
 const escola=form.querySelector('[name="escola_id"]'),busca=picker.querySelector('[type="search"]');
 const idSelecionado=picker.querySelector('[name="aluno_id"]');
 const selecionado=picker.querySelector('#aluno-search-selecionado');
 const feedback=picker.querySelector('#aluno-search-feedback'),resultados=picker.querySelector('#aluno-search-resultados');
 const resetar=()=>{
  idSelecionado.value='';selecionado.hidden=true;selecionado.textContent='';
 };
 const atualizar=()=>{
  resultados.replaceChildren();
  if(!escola.value){
   busca.disabled=true;busca.placeholder='Selecione uma escola primeiro';
   feedback.textContent='Selecione a escola para pesquisar os alunos cadastrados.';return;
  }
  busca.disabled=false;busca.placeholder='Digite o nome ou matrícula do aluno';
  const encontrados=buscarAlunosDisponiveis(cache.alunos,escola.value,busca.value,10);
  if(!encontrados.total){
   feedback.textContent=busca.value.trim()?'Nenhum aluno cadastrado corresponde à pesquisa nesta escola.':'Não existem alunos ativos disponíveis nesta escola.';return;
  }
  feedback.textContent='Exibindo '+encontrados.alunos.length+' de '+encontrados.total+' aluno(s) nesta escola. Se necessário, digite mais letras.';
  for(const aluno of encontrados.alunos){
   const botao=document.createElement('button');botao.type='button';botao.className='aluno-search-opcao';
   botao.dataset.alunoId=aluno.id;
   const nome=document.createElement('strong');nome.textContent=aluno.nome||'Aluno sem nome';
   const detalhes=document.createElement('small');
   detalhes.textContent=(aluno.matricula?'Matrícula '+aluno.matricula+' · ':'')+schoolName(aluno.escola_id);
   botao.append(nome,detalhes);
   botao.addEventListener('click',()=>{
    idSelecionado.value=aluno.id;busca.value=aluno.nome||'';
    selecionado.hidden=false;selecionado.textContent='Aluno selecionado: '+(aluno.nome||'Aluno sem nome')+' · '+schoolName(aluno.escola_id);
    resultados.replaceChildren();feedback.textContent='Aluno vinculado ao agendamento. Para trocar, digite outra busca.';
   });
   resultados.append(botao);
  }
 };
 escola.addEventListener('change',()=>{resetar();busca.value='';atualizar();});
 busca.addEventListener('input',()=>{resetar();atualizar();});
 busca.addEventListener('focus',()=>{if(!idSelecionado.value)atualizar();});
 busca.addEventListener('keydown',ev=>{if(ev.key==='Escape')resultados.replaceChildren();});
 atualizar();
}

function camposCadastroCompletoAluno(criacao=true){
 const secao=(titulo,descricao)=>'<div class="wide cadastro-secao"><h3>'+titulo+'</h3><p>'+descricao+'</p></div>';
 const tx=(name,label,attrs='')=>'<label>'+label+'<input type="text" name="'+name+'" '+attrs+'></label>';
 const required=tx('nome','Nome completo do aluno *','required maxlength="180" autocomplete="off"');
 const nascimento='<label>Data de nascimento *<input type="date" name="nascimento" required max="'+new Date().toISOString().slice(0,10)+'"></label>';
 const filiais=tx('mae_nome','Nome completo da mãe *','required maxlength="180"')+
 '<label>Situação do pai<select name="pai_nao_declarado"><option value="nao">Pai declarado</option><option value="sim">Pai não declarado</option></select></label>'+
 tx('pai_nome','Nome completo do pai','required maxlength="180"');
 const responsavel=tx('responsavel_nome','Nome do responsável legal *','required maxlength="180"')+
 '<label>Vínculo com o aluno *<select name="responsavel_parentesco" required><option value="Mae">Mãe</option><option value="Pai">Pai</option><option value="Avo">Avó / avô</option><option value="Tutor">Tutor / guardião legal</option><option value="Outro">Outro responsável</option></select></label>'+
 tx('responsavel_telefone','Celular / telefone do responsável *','required inputmode="tel" placeholder="(33) 99999-9999" maxlength="16"')+
 tx('responsavel_telefone_alternativo','Telefone alternativo','inputmode="tel" maxlength="16"')+
 '<label class="wide">E-mail do responsável (opcional)<input type="email" name="responsavel_email" maxlength="180" placeholder="email@exemplo.com"></label>';
 const endereco='<div class="wide cadastro-cep"><label>CEP <input type="text" name="cep" inputmode="numeric" maxlength="9" placeholder="00000-000"></label><button class="btn secondary" type="button" id="buscar-cep-aluno">Buscar CEP</button><small id="cep-aluno-estado" role="status">Busque o CEP para preencher endereço, bairro, cidade e UF. Se não encontrar, informe manualmente.</small></div>'+
 tx('logradouro','Rua / avenida / comunidade *','required maxlength="180"')+
 tx('numero','Número','maxlength="40" placeholder="S/N para sem número"')+
 tx('complemento','Complemento','maxlength="150"')+
 tx('bairro','Bairro / localidade *','required maxlength="150"')+
 tx('cidade','Município *','required maxlength="120"')+
 tx('uf','UF *','required maxlength="2" placeholder="MG"')+
 '<label class="wide">Ponto de referência<input type="text" name="referencia" maxlength="200"></label>';
 return (criacao?'<div class="wide cadastro-dica">Informe a escola e os dados do aluno. Os campos com * são obrigatórios.</div>':'<div class="wide cadastro-dica">Atualize os dados necessários sem perder histórico de consultas e agendamentos.</div>')+
 secao('Identificação','Dados para localização e identificação escolar do aluno.')+
 (criacao?schoolSelect():'')+required+nascimento+
 tx('matricula','Matrícula escolar','maxlength="80"')+
 tx('cpf','CPF do aluno (opcional)','inputmode="numeric" maxlength="14" placeholder="000.000.000-00"')+
 '<p class="wide muted cadastro-nota">A verificação de CPF confere os dígitos informados, não a situação cadastral junto à Receita Federal.</p>'+
 secao('Filiação','A identificação do pai pode ser marcada como não declarada.')+filiais+
 secao('Responsável e contato','Pessoa autorizada para contato a respeito do aluno.')+responsavel+
 secao('Endereço residencial','Dados para localização do aluno. O CEP não envia outros dados pessoais para consulta.')+endereco;
}
function configurarFormularioCompletoAluno(dados={}){
 const form=document.getElementById('entry');if(!form)return;
 const el=n=>form.elements.namedItem(n);
 const campos=['nome','nascimento','matricula','cpf','mae_nome','pai_nome','responsavel_nome','responsavel_parentesco','responsavel_telefone','responsavel_telefone_alternativo','responsavel_email','cep','logradouro','numero','complemento','bairro','cidade','uf','referencia'];
 for(const key of campos)if(el(key)&&typeof dados[key]==='string')el(key).value=dados[key];
 // Cadastros antigos tinham campos genéricos. O telefone é aproveitado; a filiação antiga
 // é apresentada para conferência sem adivinhar quem é pai ou mãe.
 if(!dados.responsavel_telefone&&dados.telefone)el('responsavel_telefone').value=dados.telefone;
 if(!dados.mae_nome&&dados.filiacao){
  const info=document.createElement('p');info.className='wide cadastro-legado';
  info.textContent='Filiação anterior: '+dados.filiacao+'. Confira e informe separadamente mãe e pai.';
  const section=form.querySelector('[name="mae_nome"]')?.closest('label');
  if(section)section.before(info);
 }
 if(!dados.logradouro&&dados.endereco){
  const info=document.createElement('p');info.className='wide cadastro-legado';
  info.textContent='Endereço anterior: '+dados.endereco+'. Confirme e distribua nos campos de endereço.';
  const section=form.querySelector('[name="cep"]')?.closest('.cadastro-cep');
  if(section)section.before(info);
 }
 const paiEstado=el('pai_nao_declarado'),pai=el('pai_nome');
 paiEstado.value=dados.pai_nao_declarado===true?'sim':'nao';
 const aplicarPai=()=>{const nao=paiEstado.value==='sim';pai.disabled=nao;pai.required=!nao;if(nao)pai.value='';};
 paiEstado.onchange=aplicarPai;aplicarPai();
 const cpf=el('cpf');cpf.addEventListener('input',()=>{cpf.value=formatarCPF(cpf.value);cpf.setCustomValidity('');});
 const cep=el('cep');cep.addEventListener('input',()=>{cep.value=formatarCEP(cep.value);});
 for(const nome of ['responsavel_telefone','responsavel_telefone_alternativo']){
  const telefone=el(nome);telefone.addEventListener('input',()=>{telefone.value=formatarTelefone(telefone.value);});
 }
 const uf=el('uf');uf.addEventListener('input',()=>uf.value=uf.value.replace(/[^a-z]/ig,'').slice(0,2).toUpperCase());
 const estado=document.getElementById('cep-aluno-estado'),botao=document.getElementById('buscar-cep-aluno');
 let ultimaConsulta='',token=0;
 const buscar=async()=>{
  const codigo=cep.value.replace(/\D/g,'');
  if(codigo.length!==8){estado.textContent='Digite um CEP completo de oito dígitos.';return}
  if(ultimaConsulta===codigo)return;
  const requestId=++token;
  botao.disabled=true;estado.textContent='Consultando CEP...';
  try{
   const resultado=await consultarCEP(codigo);
   if(requestId!==token||cep.value.replace(/\D/g,'')!==codigo)return;
   for(const campo of ['logradouro','bairro','cidade','uf'])if(resultado[campo])el(campo).value=resultado[campo];
   ultimaConsulta=codigo;estado.textContent='CEP encontrado. Confira o endereço e complete o número ou referência.';
   el('numero').focus();
  }catch(e){if(requestId===token)estado.textContent=e.message+' Os campos podem ser preenchidos manualmente.';}
  finally{if(requestId===token)botao.disabled=false}
 };
 botao.onclick=buscar;
 cep.addEventListener('blur',()=>{if(cep.value.replace(/\D/g,'').length===8&&cep.value.replace(/\D/g,'')!==ultimaConsulta)buscar();});
}
async function salvarCadastroCompletoAluno(d,{existente=null,privadoAnterior={}}={}){
 if(!canWrite()&&!canManage())throw Error('Sem permissão para cadastrar ou editar alunos.');
 const partes=prepararCadastroAluno(d,{
  escolaId:existente?.escola_id||d.escola_id,criadoPor:user.uid,
  existente,privadoAnterior
 });
 if(existente){
  const id=existente.id,batch=writeBatch(db);
  batch.update(doc(db,'alunos',id),{
   nome:partes.publico.nome,nascimento:partes.publico.nascimento,
   matricula:partes.publico.matricula
  });
  const ref=doc(db,'alunos_privado',id);
  const privado={...partes.privado,criado_por:privadoAnterior?.criado_por||user.uid,escola_id:existente.escola_id};
  if(privadoAnterior?._exists)batch.update(ref,privado);
  else batch.set(ref,privado);
  await batch.commit();
 }else{
  const ref=doc(collection(db,'alunos')),batch=writeBatch(db);
  batch.set(ref,partes.publico);
  batch.set(doc(db,'alunos_privado',ref.id),partes.privado);
  await batch.commit();
 }
}

function modal(name,form,submit){document.body.insertAdjacentHTML('beforeend','<div class="modalback" id="back"><div class="modal"><button class="btn secondary close" id="close">Fechar</button><h2>'+name+'</h2><form id="entry"><div class="formgrid">'+form+'</div><p class="actions" style="justify-content:flex-end;margin-top:20px"><button class="btn" type="submit">Salvar</button></p></form></div></div>');document.getElementById('close').onclick=()=>document.getElementById('back').remove();document.getElementById('entry').onsubmit=async event=>{event.preventDefault();const button=event.target.querySelector('[type=submit]');button.disabled=true;try{const data=Object.fromEntries(new FormData(event.target));await submit(data);document.getElementById('back').remove();await refresh();render()}catch(e){showError(e)}finally{button.disabled=false}}}
function fromInputDate(s){const d=new Date(s);if(!s||isNaN(d))throw Error('Data inválida');return d}
function horarioLocal(d){
 const p=n=>String(n).padStart(2,'0');
 return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());
}

function slotId(uid,data){return uid+'_'+data.getTime()}
async function salvarAgendamento(payload){
 const inicio=payload.inicio;
 if(!(inicio instanceof Date)||!Number.isFinite(inicio.getTime())||inicio.getSeconds()!==0||inicio.getMinutes()%30!==0)throw Error('Selecione uma hora cheia ou meia hora.');
 if(inicio<=new Date())throw Error('Agendamentos precisam estar no futuro.');
 const ref=doc(collection(db,'agendamentos'));
 const slots=[inicio,...(payload.duracao_min===60?[new Date(inicio.getTime()+1800000)]:[])];
 const refs=slots.map(t=>doc(db,'agenda_slots',slotId(user.uid,t)));
 await runTransaction(db,async tx=>{
  const atuais=await Promise.all(refs.map(r=>tx.get(r)));
  if(atuais.some(x=>x.exists()&&x.data().status==='reservado'))throw Error('Horário ocupado. Escolha outro.');
  tx.set(ref,{...payload,status:'agendado'});
  refs.forEach((r,i)=>tx.set(r,{autor_uid:user.uid,escola_id:payload.escola_id,agendamento_id:ref.id,inicio:slots[i],status:'reservado'}));
 });
}

/** Consulta vinculada: a reserva permanece ocupada até ser concluída. */
function abrirAgendamento(id){
 const a=cache.agendamentos.find(x=>x.id===id);
 if(!a)return showError(Error('Agendamento não encontrado. Atualize a agenda.'));
 const estudante=cache.alunos.find(x=>x.id===a.aluno_id);
 const dono=canWrite()&&a.autor_uid===user.uid;
 const situacao={agendado:'Agendado',em_atendimento:'Em atendimento',realizado:'Realizado',cancelado:'Cancelado',remarcado:'Remarcado',falta_aluno:'Falta do aluno',falta_profissional:'Falta profissional'}[a.status]||a.status||'Não informada';
 const acoes=dono&&a.status==='agendado'
  ?'<button type="button" class="btn" id="iniciar-consulta">Iniciar consulta</button><button type="button" class="btn secondary" id="reagendar-consulta">Reagendar</button>'+(dataMs(a.inicio)<=Date.now()?'<button type="button" class="btn secondary" id="registrar-falta">Registrar falta</button>':'')+'<button type="button" class="btn secondary" id="cancelar-consulta">Cancelar</button>'
  :dono&&a.status==='em_atendimento'
  ?'<button type="button" class="btn" id="continuar-consulta">Continuar consulta</button>'
  :a.status==='realizado'
  ?'<button type="button" class="btn secondary" id="ver-consulta-realizada">Ver no histórico de atendimentos</button>'
  :dono&&['falta_aluno','falta_profissional'].includes(a.status)&&!a.novo_agendamento_id
  ?'<button type="button" class="btn" id="reagendar-consulta">Reagendar após falta</button>'
  :a.novo_agendamento_id
  ?'<button type="button" class="btn secondary" id="ver-novo-agendamento">Ver novo agendamento</button>'
  :'';
 document.body.insertAdjacentHTML('beforeend','<div class="modalback" id="detalhe-agendamento"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-agendamento">'+
  '<button type="button" class="btn secondary close" id="fechar-agendamento">Fechar</button><span class="eyebrow">AGENDA · CONSULTA</span><h2 id="titulo-agendamento">Detalhes do agendamento</h2>'+
  '<div class="appointment-summary"><span class="status-pill status-'+safe(a.status)+'">'+safe(situacao)+'</span>'+
  '<div><span>Aluno</span><strong>'+safe(estudante?.nome||'Aluno cadastrado')+'</strong></div>'+
  '<div><span>Escola</span><strong>'+safe(schoolName(a.escola_id))+'</strong></div>'+
  '<div><span>Profissional</span><strong>'+safe(a.autor_nome||professionalName(a.autor_uid))+'</strong></div>'+
  '<div><span>Data e horário</span><strong>'+safe(formatDate(a.inicio))+' · '+safe(a.duracao_min)+' minutos</strong></div>'+
  '<div><span>Especialidade</span><strong>'+safe(a.especialidade||'Não informada')+'</strong></div></div>'+
  (a.status==='em_atendimento'?'<p class="appointment-tip">Atendimento iniciado. Você pode continuar e registrar a evolução da consulta.</p>':'')+
  (a.motivo_falta?'<p class="appointment-tip"><strong>Justificativa de ausência:</strong> '+safe(a.motivo_falta)+'</p>':'')+
  (a.motivo_remarcacao?'<p class="appointment-tip"><strong>Motivo da remarcação:</strong> '+safe(a.motivo_remarcacao)+'</p>':'')+
  '<div class="actions appointment-actions">'+acoes+'</div></section></div>');
 const back=document.getElementById('detalhe-agendamento');
 back.querySelector('#fechar-agendamento').onclick=()=>back.remove();
 const iniciar=back.querySelector('#iniciar-consulta');
 if(iniciar)iniciar.onclick=async()=>{iniciar.disabled=true;try{await iniciarConsultaAgendada(id);back.remove();abrirConsultaAgendada(id)}catch(e){showError(e)}finally{iniciar.disabled=false}};
 const continuar=back.querySelector('#continuar-consulta');
 if(continuar)continuar.onclick=()=>{back.remove();abrirConsultaAgendada(id)};
 const cancelar=back.querySelector('#cancelar-consulta');
 if(cancelar)cancelar.onclick=async()=>{back.remove();await cancelarAgendamento(id)};
 const falta=back.querySelector('#registrar-falta');
 if(falta)falta.onclick=()=>{back.remove();abrirRegistroFalta(id)};
 const reagendar=back.querySelector('#reagendar-consulta');
 if(reagendar)reagendar.onclick=()=>{back.remove();abrirReagendamento(id)};
 const novo=back.querySelector('#ver-novo-agendamento');
 if(novo)novo.onclick=()=>{const novoId=a.novo_agendamento_id;back.remove();abrirAgendamento(novoId)};
 const historico=back.querySelector('#ver-consulta-realizada');
 if(historico)historico.onclick=()=>{back.remove();filtrosAtendimentos={nome:estudante?.nome||''};tab='Atendimentos';render()};
}

function abrirRegistroFalta(id){
 const a=cache.agendamentos.find(x=>x.id===id);
 if(!a||a.status!=='agendado'||a.autor_uid!==user.uid||!canWrite())return;
 if(dataMs(a.inicio)>Date.now()){showError(Error('Uma ausência só pode ser registrada após o início do horário previsto.'));return}
 modal('Registrar ausência no agendamento',
  '<p class="wide muted">Aluno: '+safe(cache.alunos.find(x=>x.id===a.aluno_id)?.nome)+' · '+safe(formatDate(a.inicio))+'. O motivo ficará documentado no histórico.</p>'+
  select('tipo','Tipo de ausência',[['falta_aluno','Falta do aluno'],['falta_profissional','Falta da profissional']])+
  '<label class="wide">Descrição / justificativa<textarea name="motivo" maxlength="500" required placeholder="Registre o ocorrido."></textarea></label>',
  async d=>registrarFaltaAgendamento(id,d.tipo,d.motivo));
}
async function registrarFaltaAgendamento(id,tipo,motivo){
 if(!canWrite()||!['falta_aluno','falta_profissional'].includes(tipo))throw Error('Tipo de ausência inválido.');
 const texto=String(motivo||'').trim();
 if(!texto||texto.length>500)throw Error('Informe a justificativa em até 500 caracteres.');
 const ref=doc(db,'agendamentos',id);
 await runTransaction(db,async tx=>{
  const snap=await tx.get(ref);
  if(!snap.exists())throw Error('Agendamento não encontrado.');
  const a=snap.data();
  if(a.status!=='agendado'||a.autor_uid!==user.uid||dataMs(a.inicio)>Date.now())throw Error('Esta ausência não pode ser registrada.');
  const inicio=a.inicio.toDate(),tempos=[inicio,...(a.duracao_min===60?[new Date(inicio.getTime()+1800000)]:[])];
  const locks=tempos.map(t=>doc(db,'agenda_slots',slotId(user.uid,t)));
  const dados=await Promise.all(locks.map(x=>tx.get(x)));
  if(dados.some(x=>!x.exists()||x.data().agendamento_id!==id||x.data().status!=='reservado'))throw Error('Reserva de horário inconsistente.');
  tx.update(ref,{status:tipo,motivo_falta:texto,falta_registrada_em:serverTimestamp()});
  locks.forEach(x=>tx.update(x,{status:'liberado'}));
 });
}
function abrirReagendamento(id){
 const a=cache.agendamentos.find(x=>x.id===id);
 if(!a||a.autor_uid!==user.uid||!canWrite()||!['agendado','falta_aluno','falta_profissional'].includes(a.status)||a.novo_agendamento_id){
  showError(Error('Este agendamento não está disponível para remarcação.'));return;
 }
 modal('Reagendar consulta',
  '<p class="wide muted">Aluno: '+safe(cache.alunos.find(x=>x.id===a.aluno_id)?.nome)+' · '+safe(schoolName(a.escola_id))+
  '. A data anterior e as justificativas permanecerão no histórico.</p>'+
  field('inicio','Nova data e hora','datetime-local','required')+
  '<label class="wide">Motivo do reagendamento<textarea name="motivo" required maxlength="500" placeholder="Descreva o motivo da alteração."></textarea></label>',
  async d=>reagendarAgendamento(id,d.inicio,d.motivo));
 const hora=document.querySelector('#entry [name=inicio]');
 if(hora){const agora=new Date();agora.setSeconds(0,0);agora.setMinutes(Math.floor(agora.getMinutes()/30)*30+30);hora.value=horarioLocal(agora)}
}
async function reagendarAgendamento(id,novoHorario,motivo){
 if(!canWrite())throw Error('Somente a profissional responsável pode reagendar.');
 const texto=String(motivo||'').trim();
 if(!texto||texto.length>500)throw Error('Informe o motivo em até 500 caracteres.');
 const inicio=fromInputDate(novoHorario);
 if(inicio.getSeconds()!==0||inicio.getMinutes()%30!==0||inicio<=new Date())throw Error('Escolha data futura em hora cheia ou meia hora.');
 const atual=cache.agendamentos.find(x=>x.id===id);
 if(!atual||atual.autor_uid!==user.uid||!['agendado','falta_aluno','falta_profissional'].includes(atual.status)||atual.novo_agendamento_id)throw Error('Agendamento indisponível.');
 eligible(inicio,atual.escola_id,Number(atual.duracao_min));
 const vinculo=cache.vinculos.find(v=>v.id===atual.vinculo_id&&v.uid===user.uid&&v.ativo===true);
 if(!vinculo||!dentroDaJornada(inicio,Number(atual.duracao_min),vinculo.horarios))throw Error('A nova data está fora da jornada ou não possui vínculo ativo.');
 const novo=doc(collection(db,'agendamentos')),origem=doc(db,'agendamentos',id);
 const novaGrade=[inicio,...(atual.duracao_min===60?[new Date(inicio.getTime()+1800000)]:[])];
 await runTransaction(db,async tx=>{
  const snap=await tx.get(origem);
  if(!snap.exists())throw Error('Consulta original não encontrada.');
  const velho=snap.data();
  if(velho.autor_uid!==user.uid||!['agendado','falta_aluno','falta_profissional'].includes(velho.status)||velho.novo_agendamento_id)throw Error('O agendamento já foi alterado. Atualize a tela.');
  const antigoInicio=velho.inicio.toDate();
  const antigaGrade=velho.status==='agendado'?[antigoInicio,...(velho.duracao_min===60?[new Date(antigoInicio.getTime()+1800000)]:[])]:[];
  const antigos=antigaGrade.map(t=>doc(db,'agenda_slots',slotId(user.uid,t)));
  const novos=novaGrade.map(t=>doc(db,'agenda_slots',slotId(user.uid,t)));
  const [antigosDocs,novosDocs]=await Promise.all([
   Promise.all(antigos.map(x=>tx.get(x))),Promise.all(novos.map(x=>tx.get(x)))
  ]);
  if(antigosDocs.some(x=>!x.exists()||x.data().status!=='reservado'||x.data().agendamento_id!==id))throw Error('A reserva anterior foi alterada.');
  if(novosDocs.some(x=>x.exists()&&x.data().status!=='liberado'))throw Error('O novo horário já está ocupado.');
  tx.update(origem,{status:velho.status==='agendado'?'remarcado':velho.status,novo_agendamento_id:novo.id,remarcado_em:serverTimestamp(),motivo_remarcacao:texto});
  antigos.forEach(x=>tx.update(x,{status:'liberado'}));
  tx.set(novo,{
   escola_id:velho.escola_id,aluno_id:velho.aluno_id,vinculo_id:velho.vinculo_id,
   inicio,duracao_min:velho.duracao_min,especialidade:velho.especialidade,
   autor_uid:user.uid,autor_nome:velho.autor_nome,criado_em:serverTimestamp(),status:'agendado',remarcado_de:id
  });
  novos.forEach((x,i)=>tx.set(x,{autor_uid:user.uid,escola_id:velho.escola_id,agendamento_id:novo.id,inicio:novaGrade[i],status:'reservado'}));
 });
}

async function iniciarConsultaAgendada(id){
 if(!canWrite())throw Error('Apenas profissionais especialistas podem iniciar consultas.');
 const ref=doc(db,'agendamentos',id);
 await runTransaction(db,async tx=>{
  const snap=await tx.get(ref);
  if(!snap.exists())throw Error('Agendamento não encontrado.');
  const a=snap.data();
  if(a.autor_uid!==user.uid)throw Error('Somente a profissional responsável pode iniciar a consulta.');
  if(a.status!=='agendado')throw Error('Esta consulta não está mais disponível para iniciar. Atualize a agenda.');
  tx.update(ref,{status:'em_atendimento',iniciado_em:serverTimestamp()});
 });
 await refresh();render();
}
function abrirConsultaAgendada(id){
 const a=cache.agendamentos.find(x=>x.id===id);
 if(!a||!canWrite()||a.autor_uid!==user.uid||a.status!=='em_atendimento'){
  showError(Error('A consulta não está em andamento ou você não é a profissional responsável.'));return;
 }
 const aluno=cache.alunos.find(x=>x.id===a.aluno_id);
 modal('Consulta em andamento',
  '<div class="wide consult-info"><strong>'+safe(aluno?.nome||'Aluno')+'</strong><span>'+safe(schoolName(a.escola_id))+' · '+safe(a.especialidade)+' · '+safe(formatDate(a.inicio))+'</span></div>'+
  camposRegistroConsulta()+
  '<p class="wide muted">Ao finalizar, o registro será salvo e vinculado à consulta. Se fechar sem concluir, a consulta continuará em andamento; textos não finalizados não são salvos.</p>',
  async d=>finalizarConsultaAgendada(id,registroConsultaTexto(d),d.evolucao_observada));

 const botao=document.querySelector('#entry [type=submit]');
 if(botao)botao.textContent='Finalizar consulta e salvar';
}
async function finalizarConsultaAgendada(id,observacao,evolucao='nao_avaliada'){
 if(!canWrite())throw Error('Apenas especialistas podem concluir consultas.');
 const texto=String(observacao||'').trim();
 if(!texto||texto.length>1000)throw Error('Registre o atendimento em até 1.000 caracteres.');
 const ref=doc(db,'agendamentos',id),atendimento=doc(db,'atendimentos','agenda_'+id);
 const nota=doc(db,'notas_atendimento',atendimento.id);
 await runTransaction(db,async tx=>{
  const snap=await tx.get(ref);
  if(!snap.exists())throw Error('O agendamento não existe mais.');
  const a=snap.data();
  if(a.autor_uid!==user.uid)throw Error('Somente a profissional responsável pode finalizar.');
  if(a.status!=='em_atendimento')throw Error('A consulta já foi finalizada ou não está em andamento.');
  tx.set(atendimento,{
   escola_id:a.escola_id,aluno_id:a.aluno_id,vinculo_id:a.vinculo_id,
   inicio:a.inicio,duracao_min:a.duracao_min,especialidade:a.especialidade,
   autor_uid:a.autor_uid,autor_nome:a.autor_nome,criado_em:serverTimestamp(),
   data:serverTimestamp(),status:'realizado',agendamento_id:id,evolucao_observada:evolucao
  });
  tx.set(nota,{escola_id:a.escola_id,autor_uid:a.autor_uid,atendimento_id:atendimento.id,texto,revisao:1});
  tx.update(ref,{status:'realizado',finalizado_em:serverTimestamp(),atendimento_id:atendimento.id});
 });
}

async function cancelarAgendamento(id){
 const item=cache.agendamentos.find(x=>x.id===id);
 if(!item||item.autor_uid!==user.uid||item.status!=='agendado')return;
 if(!confirm('Cancelar o agendamento e liberar o horário?'))return;
 try{
  await runTransaction(db,async tx=>{
   const ref=doc(db,'agendamentos',id),snap=await tx.get(ref);
   if(!snap.exists()||snap.data().status!=='agendado'||snap.data().autor_uid!==user.uid)throw Error('Agendamento não está mais disponível.');
   const ag=snap.data(),inicio=ag.inicio.toDate();
   const slots=[inicio,...(ag.duracao_min===60?[new Date(inicio.getTime()+1800000)]:[])];
   const refs=slots.map(t=>doc(db,'agenda_slots',slotId(user.uid,t)));
   const locks=await Promise.all(refs.map(r=>tx.get(r)));
   if(locks.some(x=>!x.exists()||x.data().agendamento_id!==id||x.data().status!=='reservado'))throw Error('Reserva de horário inconsistente.');
   tx.update(ref,{status:'cancelado'});refs.forEach(r=>tx.update(r,{status:'liberado'}));
  });
  await refresh();render();
 }catch(err){showError(err)}
}
function eligible(slot,school,duracaoMin=30){
 return podeAgendar({inicio:slot,duracaoMin,escolaId:school,uid:user.uid,vinculos:cache.vinculos,agendamentos:cache.agendamentos});
}
function configurarServidorComoEspecialista(id){
 if(!canManage())return;
 const servidor=cache.servidores.find(s=>s.id===id);
 if(!servidor)return;
 if(cache.profissionais.some(p=>p.id===id)){alert('Já existe uma ficha profissional para esse servidor.');return}
 modal('Ficha de especialista — '+safe(servidor.nome),
  '<p class="wide">O servidor permanece no quadro escolar. Criar esta ficha não libera acesso Google nem cria jornada de atendimento.</p>'+
  field('especialidade','Especialidade para atendimento','text','required')+
  field('uid','UID da conta Google aprovada (opcional)'),
  async d=>{
   if(!d.especialidade.trim())throw Error('Informe a especialidade.');
   if(d.uid.trim()&&!cache.usuarios.some(u=>u.id===d.uid.trim()&&u.ativo===true&&u.perfil==='especialista'))
    throw Error('Para informar UID, selecione uma conta Google já ativa com perfil especialista. Caso contrário, deixe o campo em branco.');
   const batch=writeBatch(db);
   batch.set(doc(db,'profissionais',servidor.id),{
    nome:servidor.nome,especialidade:d.especialidade.trim(),uid:d.uid.trim(),escolas:[servidor.escola_id]
   });
   batch.set(doc(db,'profissionais_privado',servidor.id),{
    cpf:'',telefone:'',endereco:'',nascimento:'',email:''
   });
   await batch.commit();
  });
}
function openForm(kind){
 if(kind==='frequencia'){
  const vinculos=cache.vinculos.filter(v=>v.uid===user.uid&&v.ativo===true);
  if(!vinculos.length){alert('Não há vínculo ativo para registrar frequência.');return}
  modal('Registrar entrada',select('vinculo_id','Escola e cargo',vinculos.map(v=>[v.id,schoolName(v.escola_id)+' — '+v.cargo])),
  async d=>{
   const v=vinculos.find(x=>x.id===d.vinculo_id);if(!v)throw Error('Vínculo inválido.');
   const now=new Date(),pad=x=>String(x).padStart(2,'0');
   const dia=now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate());
   await setDoc(doc(db,'frequencias',user.uid+'_'+v.escola_id+'_'+dia),{
    uid:user.uid,escola_id:v.escola_id,vinculo_id:v.id,dia,entrada:serverTimestamp(),saida:null,status:'aberta'
   });
  });
  return;
 }
 if(kind==='escola'){modal('Cadastrar escola',select('nome','Nome da instituição',schoolNames.map(n=>[n,n]))+field('inep','Código INEP')+field('telefone','Telefone')+field('endereco','Endereço')+field('email','E-mail','email')+select('tipo','Tipo da instituição',[['escola','Escola'],['creche','Creche']]),d=>addDoc(collection(db,'escolas'),d));return}
if(kind==='profissional'){modal('Cadastrar profissional',field('nome','Nome completo','text','required')+field('nascimento','Nascimento','date')+field('cpf','CPF (quando necessário)')+field('telefone','Telefone')+field('endereco','Endereço')+field('especialidade','Especialidade')+field('email','E-mail','email')+field('uid','UID do usuário Google (após aprovação)'),async d=>{if(d.cpf&&!cpfValido(d.cpf))throw Error('CPF inválido.');const id=doc(collection(db,'profissionais'));const batch=writeBatch(db);const {cpf,telefone,endereco,nascimento,email,...base}=d;batch.set(id,{...base,uid:d.uid||'',escolas:[]});batch.set(doc(db,'profissionais_privado',id.id),{cpf,telefone,endereco,nascimento,email});await batch.commit()});return}
if(kind==='vinculo'){modal('Vincular profissional',select('profissional_id','Profissional',cache.profissionais.map(p=>[p.id,p.nome]))+schoolSelect()+field('cargo','Cargo','text','required')+field('jornada','Jornada semanal (ex.: 20 horas)')+field('uid','UID do usuário Google da profissional','text','required')+field('horarios_texto','Dias e horários (ex.: 1 08:00-12:00; 3 13:00-17:00)','text','required'),async d=>{const horarios=lerHorarios(d.horarios_texto);delete d.horarios_texto;await addDoc(collection(db,'vinculos'),{...d,horarios,slots_semana:gerarSlotsSemana(horarios),ativo:true})});return}
if(kind==='aluno'){modal('Cadastrar aluno',camposCadastroCompletoAluno(true),d=>salvarCadastroCompletoAluno(d));configurarFormularioCompletoAluno();return}
if(kind==='usuario'){modal('Autorizar usuário',field('uid','UID do usuário pendente','text','required')+select('perfil','Perfil',[['especialista','Especialista'],['direcao','Direção escolar'],['secretaria','Secretaria de Educação']])+field('escolas','IDs das escolas autorizadas, separados por vírgula') ,async d=>{const ref=doc(db,'usuarios',d.uid);const current=await getDoc(ref);if(!current.exists())throw Error('O usuário deve fazer login com Google antes da autorização.');if(current.data().perfil==='superadmin')throw Error('Não é permitido alterar o superadministrador.');await updateDoc(ref,{perfil:d.perfil,escolas:d.escolas.split(',').map(s=>s.trim()).filter(Boolean),ativo:true})});return}
if(kind==='atendimento'||kind==='agendar'){
 if(!canWrite()){showError(Error('Somente especialistas autorizadas podem registrar consultas.'));return}
 if(!cache.alunos.length){alert('Cadastre primeiro o aluno na escola correspondente.');return}
 const isAgenda=kind==='agendar';
 const fields=schoolSelect()+seletorAlunoPesquisavel()+
 field('inicio',isAgenda?'Data e hora do agendamento':'Data e hora da consulta realizada','datetime-local','required')+
 select('duracao_min','Duração',[[30,'30 minutos'],[60,'60 minutos']])+
 field('especialidade','Especialidade','text','required maxlength="150"');
 modal(isAgenda?'Agendar consulta':'Registrar consulta sem agendamento',fields+
 (isAgenda?'<p class="wide muted">Ao iniciar a consulta pela agenda, o registro será vinculado automaticamente ao aluno.</p>':camposRegistroConsulta()),
 async d=>{
  if(!d.aluno_id)throw Error('Pesquise e selecione um aluno cadastrado na escola para continuar.');
  const student=cache.alunos.find(a=>a.id===d.aluno_id);
  if(!student||student.ativo===false||student.escola_id!==d.escola_id)throw Error('Selecione um aluno ativo da instituição.');
  const date=fromInputDate(d.inicio),duracao=Number(d.duracao_min);
  if(isAgenda)eligible(date,d.escola_id,duracao);
  else if(date.getTime()>Date.now()+60000)throw Error('A consulta avulsa deve ter ocorrido hoje ou em data anterior. Para consultas futuras, utilize a agenda.');
  const vinculo=cache.vinculos.find(v=>v.escola_id===d.escola_id&&v.uid===user.uid&&v.ativo===true&&dentroDaJornada(date,duracao,v.horarios));
  if(!vinculo)throw Error('Não existe vínculo ativo e jornada autorizada para este aluno, escola e horário.');
  const {descricao,atividades,observacoes,orientacoes,evolucao_observada,...campos}=d;
  const payload={...campos,vinculo_id:vinculo.id,inicio:date,duracao_min:duracao,
   autor_uid:user.uid,autor_nome:profile.nome||user.displayName,criado_em:serverTimestamp()};
  if(isAgenda)await salvarAgendamento(payload);
  else{
   const texto=registroConsultaTexto({descricao,atividades,observacoes,orientacoes});
   const ref=doc(collection(db,'atendimentos')),batch=writeBatch(db);
   batch.set(ref,{...payload,data:date,status:'realizado',evolucao_observada:evolucao_observada||'nao_avaliada'});
   batch.set(doc(db,'notas_atendimento',ref.id),{escola_id:d.escola_id,autor_uid:user.uid,texto,atendimento_id:ref.id,revisao:1});
   await batch.commit();
  }
 });
 ativarBuscaAlunosDoFormulario();
 const entrada=document.querySelector('#entry [name=inicio]');
 if(entrada){
  const agora=new Date();
  if(isAgenda){agora.setSeconds(0,0);agora.setMinutes(Math.floor(agora.getMinutes()/30)*30+30)}
  entrada.value=horarioLocal(agora);
 }
 return;
}
}
function camposRegistroConsulta(){
 return '<label class="wide">Motivo / objetivo do atendimento<textarea name="descricao" maxlength="1200" required placeholder="Por que a consulta foi realizada?"></textarea></label>'+
 '<label class="wide">Atividades, intervenções e procedimentos<textarea name="atividades" maxlength="1200" placeholder="O que foi realizado durante o atendimento?"></textarea></label>'+
 '<label class="wide">Observações, resposta e comportamento identificado<textarea name="observacoes" maxlength="1200" placeholder="Registre fatos observados e contexto, sem inferir diagnósticos."></textarea></label>'+
 '<label class="wide">Orientações, encaminhamentos e próximos passos<textarea name="orientacoes" maxlength="1200" placeholder="Quais orientações e ações ficaram definidas?"></textarea></label>'+
 select('evolucao_observada','Evolução observada pela profissional',[
  ['nao_avaliada','Não avaliada nesta consulta'],['avanco_observado','Avanço observado'],
  ['sem_mudanca_observada','Sem mudança observada'],['reavaliacao_necessaria','Reavaliação necessária']])+
 '<p class="wide muted">A evolução é uma declaração da profissional responsável. O sistema não realiza avaliações clínicas automáticas.</p>';
}
function registroConsultaTexto(campos){
 const partes=[['Motivo / objetivo',campos.descricao],['Atividades e procedimentos',campos.atividades],['Observações e resposta',campos.observacoes],['Orientações e encaminhamentos',campos.orientacoes]];
 const texto=partes.filter(([,v])=>String(v||'').trim()).map(([titulo,valor])=>titulo+':\n'+String(valor).trim()).join('\n\n');
 if(!String(campos.descricao||'').trim())throw Error('Descreva o motivo ou objetivo da consulta.');
 if(texto.length>5000)throw Error('O registro excedeu o limite de 5.000 caracteres.');
 return texto;
}


function mostrarAcompanhamento(id){
 if(profile?.perfil!=='superadmin'&&profile?.perfil!=='especialista')return;
 const dados=cache.alunos_necessidades.find(x=>x.id===id);
 if(!dados)return;
 const aluno=cache.alunos.find(x=>x.id===id);
 const corpo='<div class="alert">Registro escolar informado pela instituição. Não representa diagnóstico ou laudo clínico validado.</div>'+
 '<p><strong>Aluno:</strong> '+safe(aluno?.nome||'Aluno')+'</p>'+
 '<p><strong>Turma:</strong> '+safe(dados.turma)+'</p>'+
 '<p><strong>Ano letivo:</strong> '+safe(dados.ano_letivo)+'</p>'+
 '<p><strong>Informação de acompanhamento:</strong></p>'+
 '<div class="card" style="white-space:pre-wrap">'+safe(dados.registro_escolar)+'</div>';
 document.body.insertAdjacentHTML('beforeend','<div class="modalback" id="acompanhamento-back"><div class="modal"><button class="btn secondary close" id="fechar-acompanhamento">Fechar</button><h2>Acompanhamento escolar</h2>'+corpo+'</div></div>');
 document.getElementById('fechar-acompanhamento').onclick=()=>document.getElementById('acompanhamento-back').remove();
}
function abrirImportadorAlunos(){
 if(profile?.perfil!=='superadmin')return;
 document.body.insertAdjacentHTML('beforeend',
  '<div class="modalback" id="alunos-import-back"><div class="modal">'+
  '<button class="btn secondary close" id="alunos-import-close">Fechar</button>'+
  '<h2>Importar alunos especiais — 2026</h2>'+
  '<p>Os dados são lidos localmente no navegador. Confira as escolas antes de gravar os registros no Firestore.</p>'+
  '<div class="alert">Contém informações pessoais sensíveis de crianças. A importação exige autorização institucional e não envia os dados ao GitHub.</div>'+
  '<label>Arquivo JSON privado<input type="file" id="arquivo-alunos-json" accept=".json,application/json"></label>'+
  '<p class="muted" id="alunos-import-status">Selecione o arquivo para validar a estrutura.</p>'+
  '<div id="alunos-import-schools"></div>'+
  '<div class="actions"><button class="btn" id="alunos-import-start" type="button" disabled>Confirmar importação</button></div>'+
  '</div></div>');
 const back=document.getElementById('alunos-import-back');
 const status=document.getElementById('alunos-import-status'),area=document.getElementById('alunos-import-schools');
 const start=document.getElementById('alunos-import-start');
 document.getElementById('alunos-import-close').onclick=()=>back.remove();
 let verificado=null;
 const mapping=()=>Object.fromEntries([...area.querySelectorAll('select[data-origem]')].map(x=>[x.dataset.origem,x.value]));
 function checarSelecoes(){
  const mapa=mapping();
  const choices=Object.values(mapa).filter(Boolean);
  const valido=verificado&&Object.keys(mapa).length===verificado.escolas.length&&
    choices.length===verificado.escolas.length&&new Set(choices).size===choices.length;
  start.disabled=!valido;
  if(verificado)status.textContent=verificado.total+' alunos no arquivo. '+(valido?'Correspondência de escolas confirmada.':'Selecione uma escola diferente para cada origem.');
 }
 document.getElementById('arquivo-alunos-json').onchange=async ev=>{
  verificado=null;start.disabled=true;area.innerHTML='';
  const file=ev.target.files?.[0];if(!file)return;
  if(file.size>3000000){status.textContent='Arquivo acima do limite de 3 MB.';return}
  try{
   const dados=JSON.parse(await file.text());
   const validado=conferirAlunosEspeciais(dados);
   if(validado.total!==74)throw Error('O relatório esperado contém 74 registros; este arquivo tem '+validado.total+'.');
   verificado=validado;
   area.innerHTML='<h3>Correspondência das escolas</h3>'+
    verificado.escolas.map(escolaId=>{
     const school=Object.values(escolasImportacao).find(x=>x.id===escolaId);
     const sugestao=encontrarEscola(escolaId,cache.escolas);
     return '<label>'+safe(school?.nome||escolaId)+
      '<select data-origem="'+safe(escolaId)+'">'+
      '<option value="">Selecione uma escola cadastrada</option>'+
      cache.escolas.map(e=>'<option value="'+safe(e.id)+'"'+(e.id===sugestao?' selected':'')+'>'+safe(e.nome)+'</option>').join('')+
      '</select></label>';
    }).join('');
   area.querySelectorAll('select').forEach(x=>x.onchange=checarSelecoes);
   checarSelecoes();
  }catch(e){status.textContent='Arquivo não validado: '+e.message;verificado=null}
 };
 start.onclick=async()=>{
  if(start.disabled||!verificado||profile?.perfil!=='superadmin')return;
  const map=mapping();
  if(!confirm('Confirmar inclusão dos alunos de 2026 e seus registros escolares restritos? Documentos já existentes serão preservados.'))return;
  start.disabled=true;
  try{
   const presentes=await getDocs(collection(db,'alunos'));
   const ids=new Set(presentes.docs.map(d=>d.id));
   const novos=verificado.registros.filter(r=>!ids.has(r.id));
   const nomeNormal=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
   const nomesAtuais=new Set(presentes.docs.map(d=>nomeNormal(d.data().nome)+'|'+d.data().escola_id));
   const possiveisDuplicados=novos.filter(r=>nomesAtuais.has(nomeNormal(r.publico.nome)+'|'+map[r.publico.escola_id]));
   if(possiveisDuplicados.length)throw Error('Foram encontrados '+possiveisDuplicados.length+' possíveis cadastros duplicados pelo nome e escola. Revise esses cadastros antes de importar.');
   for(let i=0;i<novos.length;i+=3){
    const lote=writeBatch(db);
    for(const item of novos.slice(i,i+3)){
     const escolaId=map[item.publico.escola_id];
     if(!escolaId)throw Error('Uma escola não foi associada.');
     lote.set(doc(db,'alunos',item.id),{
      nome:item.publico.nome,nascimento:'',matricula:'',escola_id:escolaId,
      criado_por:user.uid,ativo:true
     });
     lote.set(doc(db,'alunos_privado',item.id),{
      cpf:'',filiacao:'',telefone:'',endereco:'',escola_id:escolaId,
      criado_por:user.uid
     });
     lote.set(doc(db,'alunos_necessidades',item.id),{
      aluno_id:item.id,escola_id:escolaId,turma:item.publico.turma,
      registro_escolar:item.privado.deficiencia,ano_letivo:2026,
      origem:'relatorio_escolar_2026',importado_por:user.uid,criado_em:serverTimestamp()
     });
    }
    await lote.commit();
    status.textContent='Gravados '+Math.min(i+3,novos.length)+' de '+novos.length+' novos alunos.';
   }
   status.textContent='Importação concluída: '+novos.length+' novos alunos; '+(verificado.total-novos.length)+' já existentes.';
   await refresh();alert(status.textContent);back.remove();render();
  }catch(e){status.textContent='Importação interrompida: '+e.message+' Os lotes anteriores permanecem gravados. Selecione o arquivo novamente para continuar.';start.disabled=false}
 };
}

function abrirImportadorServidores(){
 if(!canManage())return;
 const conteudo='<p>Selecione o JSON privado de importação revisada. Nenhum dado é enviado ao GitHub. A gravação só ocorrerá depois da sua confirmação.</p>'+
 '<label>Arquivo de servidores 2026 (.json)<input type="file" id="arquivo-servidores" accept=".json,application/json"></label>'+
 '<p class="muted" id="import-status">Aguardando seleção do arquivo.</p>'+
 '<button type="button" class="btn" id="confirmar-importacao" disabled>Importar no Firestore</button>';
 document.body.insertAdjacentHTML('beforeend','<div class="modalback" id="import-back"><div class="modal"><button type="button" class="btn secondary close" id="fechar-importacao">Fechar</button><h2>Importação de servidores</h2>'+conteudo+'</div></div>');
 const back=document.getElementById('import-back'),status=document.getElementById('import-status'),botao=document.getElementById('confirmar-importacao');
 const close=()=>back.remove();document.getElementById('fechar-importacao').onclick=close;
 let verificado=null;
 document.getElementById('arquivo-servidores').onchange=async ev=>{
  verificado=null;botao.disabled=true;
  const file=ev.target.files?.[0];if(!file)return;
  if(file.size>3_000_000){status.textContent='Arquivo acima do limite de 3 MB.';return}
  try{
   const data=JSON.parse(await file.text());
   verificado=conferirImportacao(data);
   const escolasAusentes=verificado.escolas.filter(e=>!encontrarEscola(e.id,cache.escolas));
   if(escolasAusentes.length)throw Error('Antes de importar, cadastre as seis instituições pela opção Escolas → Adicionar escolas iniciais. Faltam: '+escolasAusentes.map(x=>x.nome).join('; '));
   status.textContent='Arquivo validado: '+verificado.total+' servidores; '+(verificado.contagens['creche-wilma-gloria']||0)+' vinculados à Creche Wilma Glória. Nenhum aluno incluído. Registros existentes serão preservados.';
   botao.disabled=false;
  }catch(err){status.textContent='Não foi possível validar: '+err.message}
 };
 botao.onclick=async()=>{
  if(!verificado||!canManage())return;
  if(!confirm('Confirmar importação de '+verificado.total+' servidores ao Firestore? Os cadastros existentes serão preservados.'))return;
  botao.disabled=true;
  try{
   const atuais=await getDocs(collection(db,'servidores'));
   const ids=new Set(atuais.docs.map(d=>d.id));
   const novos=verificado.registros.filter(x=>!ids.has(x.id));
   if(!novos.length){status.textContent='Todos os servidores deste arquivo já estão cadastrados.';return}
   // Lotes pequenos: Firestore limita acessos a documentos nas regras de operações agrupadas.
   for(let i=0;i<novos.length;i+=6){
    const batch=writeBatch(db),bloco=novos.slice(i,i+6);
    for(const linha of bloco){
     batch.set(doc(db,'servidores',linha.id),{...linha.publico,escola_id:encontrarEscola(linha.publico.escola_id,cache.escolas)});
     batch.set(doc(db,'servidores_privado',linha.id),{...linha.privado,escola_id:encontrarEscola(linha.publico.escola_id,cache.escolas)});
    }
    await batch.commit();
    status.textContent='Importados '+Math.min(i+6,novos.length)+' de '+novos.length+' novos servidores...';
   }
   status.textContent='Concluído: '+novos.length+' novos servidores; '+(verificado.total-novos.length)+' já existentes. Dados protegidos no Firestore.';
   await refresh();
   alert('Importação concluída. '+novos.length+' novos servidores foram cadastrados.');
   close();render();
  }catch(e){status.textContent='Importação interrompida: '+e.message+' Para retomar, selecione o mesmo arquivo e tente novamente.';botao.disabled=false}
 };
}
async function seedSchools(){
 if(!canManage())return;
 if(!confirm('Adicionar as seis instituições iniciais sem inventar endereço, telefone ou INEP?'))return;
 const ids=['doutor-joao-souza-lima','professora-terezinha-sarmento','creche-wilma-gloria','prefeito-jose-pedro','monteiro-lobato','creche-sebastiana-duarte-cabral'];
 const batch=writeBatch(db);
 for(let i=0;i<schoolNames.length;i++){
  const found=cache.escolas.some(e=>e.nome===schoolNames[i]||e.id===ids[i]);
  if(!found && cache.escolas.some(e=>e.nome.toLowerCase().includes(i===2?'wilma glória':i===5?'sebastiana duarte':'[nenhum outro similar]')))throw Error('Já existe cadastro semelhante de creche com identificador diferente. Corrija antes de criar outro.');
  if(!found)batch.set(doc(db,'escolas',ids[i]),{nome:schoolNames[i],tipo:i===2||i===5?'creche':'escola',inep:'',telefone:'',endereco:'',email:''});
  else if((i===2||i===5)&&cache.escolas.some(e=>e.id===ids[i]&&e.tipo!=='creche'))batch.update(doc(db,'escolas',ids[i]),{nome:schoolNames[i],tipo:'creche'});
 }
 try{await batch.commit();await refresh();render()}catch(e){showError(e)}
}
async function registerExit(id){
 const f=cache.frequencias.find(x=>x.id===id);if(!f||f.uid!==user.uid||f.status!=='aberta')return;
 if(!confirm('Registrar saída do trabalho neste momento?'))return;
 try{await updateDoc(doc(db,'frequencias',id),{saida:serverTimestamp(),status:'fechada'});await refresh();render()}catch(e){showError(e)}
}
async function editSchool(id){
 if(!canManage())return;
 const s=cache.escolas.find(e=>e.id===id);if(!s)return;
 modal('Cadastro da instituição',field('nome','Nome oficial','text','required')+
  field('inep','Código INEP')+field('telefone','Telefone')+field('endereco','Endereço')+
  field('email','E-mail institucional','email')+select('tipo','Tipo da instituição',[['escola','Escola'],['creche','Creche']]),async d=>{await updateDoc(doc(db,'escolas',id),d)});
 const form=document.getElementById('entry');
 for(const key of ['nome','inep','telefone','endereco','email','tipo'])form.elements.namedItem(key).value=s[key]||(key==='tipo'?'escola':'');
}
async function editStudent(id){
 if(!(canManage()||canWrite()))return;
 const aluno=cache.alunos.find(s=>s.id===id);
 if(!aluno)return;
 let anterior={};
 try{
  const ref=await getDoc(doc(db,'alunos_privado',id));
  if(ref.exists())anterior={...ref.data(),_exists:true};
 }catch(e){showError(e);return}
 modal('Editar cadastro do aluno',camposCadastroCompletoAluno(false),
  d=>salvarCadastroCompletoAluno(d,{existente:aluno,privadoAnterior:anterior}));
 configurarFormularioCompletoAluno({...aluno,...anterior});
}
async function archiveStudent(id){
 if(!(canManage()||canWrite()))return;
 const a=cache.alunos.find(s=>s.id===id);if(!a||a.ativo===false)return;
 if(!confirm('Arquivar o cadastro de '+a.nome+'? O histórico de consultas será preservado. Novos agendamentos serão bloqueados.'))return;
 try{await updateDoc(doc(db,'alunos',id),{ativo:false});await refresh();render()}catch(e){showError(e)}
}
function openUser(uid){
 const u=cache.usuarios.find(x=>x.id===uid);if(!u||u.perfil==='superadmin')return;
 modal('Permissões de '+safe(u.nome||u.email),
 select('perfil','Perfil',[['pendente','Aguardando'],['especialista','Especialista'],['direcao','Direção escolar'],['secretaria','Secretaria de Educação'],['visualizador','Somente relatórios']])+
 '<label>Permitir acesso?<select name="ativo"><option value="true">Sim</option><option value="false">Não</option></select></label>'+
 '<div class="wide"><strong>Escolas autorizadas</strong><div class="card">'+cache.escolas.map(e=>'<label class="check-school"><input type="checkbox" name="escolas" value="'+safe(e.id)+'" '+((u.escolas||[]).includes(e.id)?'checked':'')+'> '+safe(e.nome)+'</label>').join('')+'</div></div>'+
 (profile.perfil==='superadmin'?'<label>Delegar gestão de usuários e cadastros?<select name="gerenciar"><option value="false">Não</option><option value="true">Sim, para Secretaria de Educação</option></select></label>':''),
 async d=>{
  const selected=Array.from(document.querySelectorAll('#entry input[name="escolas"]:checked')).map(x=>x.value);
  if(['especialista','direcao','visualizador'].includes(d.perfil)&&d.ativo==='true'&&!selected.length)throw Error('Selecione pelo menos uma escola.');
  await updateDoc(doc(db,'usuarios',uid),{perfil:d.perfil,ativo:d.ativo==='true',escolas:selected,gerenciar:profile.perfil==='superadmin'&&d.perfil==='secretaria'&&d.gerenciar==='true'});
 });
 const form=document.getElementById('entry');form.querySelector('[name=perfil]').value=u.perfil;form.querySelector('[name=ativo]').value=String(u.ativo===true);if(form.querySelector('[name=gerenciar]'))form.querySelector('[name=gerenciar]').value=String(u.gerenciar===true);
}
function openEdit(id){const a=cache.atendimentos.find(x=>x.id===id);if(!a||!(a.autor_uid===user.uid||profile.perfil==='superadmin'))return;modal('Editar / cancelar atendimento','<label class="wide">Observações<textarea name="texto" maxlength="5000" required>'+safe(a.texto)+'</textarea></label>'+select('status','Situação',[['realizado','Realizado'],['cancelado','Cancelado']])+field('motivo','Justificativa da alteração','text','required'),async d=>{const batch=writeBatch(db);batch.update(doc(db,'atendimentos',id),{status:d.status,motivo_ultima_alteracao:d.motivo,alterado_por:user.uid,alterado_em:serverTimestamp()});const revision=Number(cache.notas_atendimento.find(n=>n.id===id)?.revisao||1)+1;batch.update(doc(db,'notas_atendimento',id),{texto:d.texto,revisao:revision,atualizado_em:serverTimestamp()});batch.set(doc(db,'notas_versoes',id+'-'+revision),{atendimento_id:id,escola_id:a.escola_id,autor_uid:a.autor_uid,editado_por:user.uid,texto_anterior:a.texto||'',texto_novo:d.texto,justificativa:d.motivo,versao:revision,em:serverTimestamp()});await batch.commit()});document.querySelector('#entry [name=status]').value=a.status||'realizado'}
initialize();
