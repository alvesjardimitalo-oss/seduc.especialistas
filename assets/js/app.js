import {firebaseConfig} from './firebase-config.js';
import {cpfValido,lerHorarios,podeAgendar,dentroDaJornada} from './validacoes.mjs';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {getFirestore,collection,doc,getDoc,getDocs,setDoc,addDoc,updateDoc,writeBatch,serverTimestamp,query,where} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const root=document.getElementById('app');
const configured=!Object.values(firebaseConfig).some(v=>!v||String(v)==='CONFIGURAR');
const schoolNames=['Escola Municipal Doutor João de Souza Lima','Escola Municipal Professora Terezinha Sarmento de Oliveira','Creche Municipal Wilma Glória Nunes Mourão','Escola Municipal Prefeito José Pedro da Silva','Escola Municipal Monteiro Lobato'];
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatDate=x=>{if(!x)return '—';const d=x?.toDate?x.toDate():new Date(x);return Number.isNaN(d.getTime())?'—':d.toLocaleString('pt-BR')};
let auth,db,user,profile,tab='Painel',cache={escolas:[],profissionais:[],vinculos:[],alunos:[],agendamentos:[],atendimentos:[],notas_atendimento:[],usuarios:[],frequencias:[]};
const canManage=()=>profile?.perfil==='superadmin'||(profile?.perfil==='secretaria'&&profile?.gerenciar===true);
const canWrite=()=>profile?.perfil==='especialista';
const mySchools=()=>profile?.perfil==='superadmin'||profile?.perfil==='secretaria'?cache.escolas:cache.escolas.filter(e=>(profile?.escolas||[]).includes(e.id));
const schoolName=id=>cache.escolas.find(s=>s.id===id)?.nome||'Instituição';
const professionalName=uid=>cache.profissionais.find(p=>p.uid===uid)?.nome||cache.atendimentos.find(a=>a.autor_uid===uid)?.autor_nome||'Profissional';
const btn=(txt,action='')=>'<button class="btn '+(action==='secondary'?'secondary':'')+'">'+safe(txt)+'</button>';
function showError(err){alert('Não foi possível concluir: '+(err?.message||String(err)))}
function showLogin(message=''){root.innerHTML='<div class="login"><div class="card"><h1>SEDUC Especialistas</h1><p class="muted">Sistema Municipal de Atendimentos Especializados</p>'+(message?'<div class="alert">'+safe(message)+'</div>':'')+'<button class="btn" id="google">Entrar com Google</button><p class="muted">Acesso exclusivo a profissionais autorizados.</p></div></div>';document.getElementById('google').onclick=()=>signInWithPopup(auth,new GoogleAuthProvider()).catch(showError)}
function showSetup(){root.innerHTML='<div class="login"><div class="card"><h1>SEDUC Especialistas</h1><div class="alert">Ambiente ainda não configurado. Nenhum dado real pode ser registrado.</div><p>Configure um projeto Firebase exclusivo em <code>assets/js/firebase-config.js</code> e publique as regras de segurança do arquivo <code>firestore.rules</code>.</p><p class="muted">Não utilize o Firebase do SISDIFI. O acesso inicial do superadministrador deve ser provisionado de modo seguro.</p></div></div>'}
async function initialize(){if(!configured){showSetup();return}const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);onAuthStateChanged(auth,async u=>{user=u;if(!u){profile=null;showLogin();return}try{const ref=doc(db,'usuarios',u.uid);let s=await getDoc(ref);if(!s.exists()){await setDoc(ref,{nome:u.displayName||u.email,email:u.email,ativo:false,perfil:'pendente',escolas:[],gerenciar:false,criado_em:serverTimestamp()});s=await getDoc(ref)}profile={id:s.id,...s.data()};if(!profile.ativo){showLogin('Sua conta foi registrada e está aguardando liberação da Secretaria de Educação.');return}await refresh();render()}catch(e){showLogin('Não foi possível verificar a autorização: '+e.message)}})}
async function refresh(){
 const manager=canManage();
 const schools=(manager||profile.perfil==='secretaria')?(await getDocs(collection(db,'escolas'))).docs.map(d=>({id:d.id,...d.data()})):(await Promise.all((profile.escolas||[]).map(async id=>{try{const s=await getDoc(doc(db,'escolas',id));return s.exists()?{id:s.id,...s.data()}:null}catch{return null}}))).filter(Boolean);
 const ids=schools.map(x=>x.id);
 const out={escolas:schools,profissionais:[],vinculos:[],alunos:[],agendamentos:[],atendimentos:[],notas_atendimento:[],usuarios:[],frequencias:[]};
 for(const key of Object.keys(out).filter(x=>x!=='escolas')){
  try{
   if(manager){const r=await getDocs(collection(db,key));out[key]=r.docs.map(d=>({id:d.id,...d.data()}));continue}
   if(key==='profissionais'||key==='usuarios'||(key==='notas_atendimento'&&profile.perfil!=='especialista')){continue}
   // Firestore rules don't filter query results. Restrict every read to authorized school IDs.
   for(let i=0;i<ids.length;i+=10){
    const chunk=ids.slice(i,i+10);if(!chunk.length)continue;
    const r=await getDocs(query(collection(db,key),where('escola_id','in',chunk)));
    out[key].push(...r.docs.map(d=>({id:d.id,...d.data()})));
   }
  }catch(e){console.warn('Sem permissão para '+key,e.message)}
 }
 if(manager){try{const r=await getDocs(collection(db,'usuarios'));out.usuarios=r.docs.map(d=>({id:d.id,...d.data()}))}catch(e){console.warn('Sem acesso a usuários:',e.message)}}
 cache=out;
 for(const a of cache.atendimentos){a.texto=cache.notas_atendimento.find(n=>n.id===a.id)?.texto||''}
}
function layout(content){const items=['Painel','Escolas','Profissionais','Alunos','Agenda','Atendimentos','Frequência','Relatórios'];if(canManage())items.push('Usuários');root.innerHTML='<div class="shell"><aside class="side"><div class="brand">SEDUC Especialistas<small>Rede Municipal de Ensino</small></div><nav class="menu">'+items.map(n=>'<button class="'+(tab===n?'active':'')+'" data-tab="'+safe(n)+'">'+safe(n)+'</button>').join('')+'</nav></aside><section><header class="top"><span>'+safe(tab)+'</span><span>'+safe(profile.nome||user.email)+' &nbsp; <button class="btn secondary" id="logout">Sair</button></span></header><main class="body">'+content+'</main></section></div>';document.getElementById('logout').onclick=()=>signOut(auth);document.querySelectorAll('[data-tab]').forEach(n=>n.onclick=()=>{tab=n.dataset.tab;render()})}
function title(name,subtitle){return '<h1>'+name+'</h1><p class="sub">'+subtitle+'</p>'}
function table(headers,rows){return '<div class="card tablewrap"><table><thead><tr>'+headers.map(x=>'<th>'+safe(x)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.join(''):'<tr><td colspan="'+headers.length+'" class="muted">Nenhum registro encontrado.</td></tr>')+'</tbody></table></div>'}
function render(){if(!profile?.ativo)return;let html=title(tab,'Acompanhamento de atendimentos especializados');const students=cache.alunos;const appointments=cache.agendamentos;const visits=cache.atendimentos;if(tab==='Painel'){html+='<div class="grid">'+[['Alunos cadastrados',students.length],['Atendimentos realizados',visits.filter(x=>x.status!=='cancelado').length],['Agendamentos',appointments.filter(x=>x.status==='agendado').length],['Instituições',mySchools().length]].map(([l,n])=>'<div class="metric"><span>'+l+'</span><b>'+n+'</b></div>').join('')+'</div>';if(canWrite())html+='<div class="actions"><button class="btn" data-action="atendimento">+ Atendimento imediato</button><button class="btn secondary" data-action="agendar">Agendar consulta</button></div>';html+='<div class="card"><h3>Últimos atendimentos</h3>'+history(visits.slice().sort((a,b)=>String(b.data||'').localeCompare(String(a.data||''))).slice(0,10))+'</div>'}
if(tab==='Escolas'){if(canManage())html+='<div class="actions"><button class="btn" data-action="escola">+ Cadastrar escola</button><button class="btn secondary" id="seed-schools">Adicionar escolas iniciais</button></div>';html+=table(['Instituição','INEP','Telefone','Endereço'],mySchools().map(x=>'<tr><td>'+safe(x.nome)+'</td><td>'+safe(x.inep)+'</td><td>'+safe(x.telefone)+'</td><td>'+safe(x.endereco)+'</td></tr>'));if(!cache.escolas.length&&canManage())html+='<div class="alert">Cadastre as escolas. Os nomes iniciais sugeridos estão disponíveis no formulário.</div>'}
if(tab==='Profissionais'){if(canManage())html+='<div class="actions"><button class="btn" data-action="profissional">+ Cadastrar profissional</button><button class="btn secondary" data-action="vinculo">+ Adicionar vínculo</button></div>';html+=table(['Nome','Especialidade','Escolas / cargo'],cache.profissionais.map(p=>'<tr><td>'+safe(p.nome)+'</td><td>'+safe(p.especialidade)+'</td><td>'+cache.vinculos.filter(v=>v.profissional_id===p.id).map(v=>safe(schoolName(v.escola_id))+' · '+safe(v.cargo)+' ('+safe(v.jornada)+')').join('<br>')+'</td></tr>'))}
if(tab==='Alunos'){if(canWrite()||canManage())html+='<div class="actions"><button class="btn" data-action="aluno">+ Cadastrar aluno</button></div>';html+=table(['Aluno','Nascimento','Escola','Histórico'],students.map(a=>'<tr><td>'+safe(a.nome)+'</td><td>'+safe(a.nascimento)+'</td><td>'+safe(schoolName(a.escola_id))+'</td><td><button class="btn secondary" data-student="'+safe(a.id)+'">Ver atendimentos</button></td></tr>'))}
if(tab==='Agenda'){if(canWrite())html+='<div class="actions"><button class="btn" data-action="agendar">+ Agendar consulta</button></div>';html+=table(['Data','Aluno','Escola','Profissional','Situação'],appointments.sort((a,b)=>String(a.inicio).localeCompare(String(b.inicio))).map(a=>'<tr><td>'+safe(formatDate(a.inicio))+'</td><td>'+safe(students.find(s=>s.id===a.aluno_id)?.nome)+'</td><td>'+safe(schoolName(a.escola_id))+'</td><td>'+safe(a.autor_nome)+'</td><td>'+safe(a.status)+'</td></tr>'))}
if(tab==='Atendimentos'){if(canWrite())html+='<div class="actions"><button class="btn" data-action="atendimento">+ Atendimento imediato</button></div>';html+='<div class="card">'+history(visits.slice().sort((a,b)=>String(b.data||'').localeCompare(String(a.data||''))))+'</div>'}
if(tab==='Frequência'){
 html+='<div class="alert">Registro declaratório de entrada e saída. Os horários devem ser conferidos pela gestão antes de uso em controle funcional oficial.</div>';
 if(canWrite())html+='<div class="actions"><button class="btn" data-action="frequencia">Registrar entrada</button></div>';
 html+=table(['Entrada','Saída','Escola','Profissional','Situação','Ação'],cache.frequencias.slice().sort((a,b)=>(b.entrada?.seconds||0)-(a.entrada?.seconds||0)).map(f=>
 '<tr><td>'+safe(formatDate(f.entrada))+'</td><td>'+safe(formatDate(f.saida))+'</td><td>'+safe(schoolName(f.escola_id))+'</td><td>'+safe(f.uid)+'</td><td>'+safe(f.status)+'</td><td>'+((f.uid===user.uid&&f.status==='aberta')?'<button class="btn secondary" data-exit="'+safe(f.id)+'">Registrar saída</button>':'—')+'</td></tr>'));
}
if(tab==='Relatórios'){html+='<div class="grid">'+[['Alunos cadastrados',students.length],['Atendimentos',visits.length],['Agendamentos',appointments.length],['Profissionais',cache.profissionais.length]].map(([l,n])=>'<div class="metric"><span>'+l+'</span><b>'+n+'</b></div>').join('')+'</div><div class="card"><p>Indicadores de acompanhamento no escopo de acesso do usuário. Exportações com dados pessoais permanecerão desativadas nesta primeira versão.</p></div>'}
if(tab==='Usuários'&&canManage()){html+='<div class="card"><p>Usuários entram com Google e aguardam aprovação. A Secretaria não recebe nem envia senhas.</p></div>';html+=table(['Usuário','E-mail','Perfil','Situação','Ação'],cache.usuarios.map(u=>'<tr><td>'+safe(u.nome)+'</td><td>'+safe(u.email)+'</td><td>'+safe(u.perfil)+'</td><td>'+safe(u.ativo?'Ativo':'Pendente')+'</td><td>'+(u.perfil==='superadmin'?'Protegido':'<button class="btn secondary" data-user="'+safe(u.id)+'">Permissões</button>')+'</td></tr>'))}
layout(html);document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>openForm(b.dataset.action));document.querySelectorAll('[data-student]').forEach(b=>b.onclick=()=>{tab='Atendimentos';render();const els=document.querySelectorAll('[data-visit]');els.forEach(el=>{if(el.dataset.student!==b.dataset.student)el.style.display='none'})});document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEdit(b.dataset.edit));document.querySelectorAll('[data-user]').forEach(b=>b.onclick=()=>openUser(b.dataset.user));document.querySelectorAll('[data-exit]').forEach(b=>b.onclick=()=>registerExit(b.dataset.exit));const seed=document.getElementById('seed-schools');if(seed)seed.onclick=seedSchools}
function history(records){return records.length?records.map(a=>'<details class="history" data-visit="'+safe(a.id)+'" data-student="'+safe(a.aluno_id)+'"><summary><b>'+safe(cache.alunos.find(s=>s.id===a.aluno_id)?.nome||'Aluno')+'</b> · '+safe(formatDate(a.data))+' · '+safe(a.autor_nome||professionalName(a.autor_uid))+' <span class="badge">'+safe(a.status||'realizado')+'</span></summary><p style="white-space:pre-wrap">'+((profile.perfil==='especialista'||profile.perfil==='superadmin')?safe(a.texto):'<em>Observações restritas aos especialistas autorizados.</em>')+'</p><small>'+safe(a.especialidade||'Atendimento especializado')+'</small>'+(a.autor_uid===user.uid||profile.perfil==='superadmin'?'<p><button class="btn secondary" data-edit="'+safe(a.id)+'">Editar / cancelar</button></p>':'')+'</details>').join(''):'<p class="muted">Ainda não há atendimentos registrados.</p>'}
function field(name,label,type='text',extra=''){return '<label>'+label+'<input name="'+name+'" type="'+type+'" '+extra+'></label>'}
function select(name,label,options){return '<label>'+label+'<select name="'+name+'" required><option value="">Selecione</option>'+options.map(([id,n])=>'<option value="'+safe(id)+'">'+safe(n)+'</option>').join('')+'</select></label>'}
function schoolSelect(){return select('escola_id','Escola',mySchools().map(s=>[s.id,s.nome]))}
function modal(name,form,submit){document.body.insertAdjacentHTML('beforeend','<div class="modalback" id="back"><div class="modal"><button class="btn secondary close" id="close">Fechar</button><h2>'+name+'</h2><form id="entry"><div class="formgrid">'+form+'</div><p class="actions" style="justify-content:flex-end;margin-top:20px"><button class="btn" type="submit">Salvar</button></p></form></div></div>');document.getElementById('close').onclick=()=>document.getElementById('back').remove();document.getElementById('entry').onsubmit=async event=>{event.preventDefault();const button=event.target.querySelector('[type=submit]');button.disabled=true;try{const data=Object.fromEntries(new FormData(event.target));await submit(data);document.getElementById('back').remove();await refresh();render()}catch(e){showError(e)}finally{button.disabled=false}}}
function fromInputDate(s){const d=new Date(s);if(!s||isNaN(d))throw Error('Data inválida');return d}
function eligible(slot,school,duracaoMin=30){
 return podeAgendar({inicio:slot,duracaoMin,escolaId:school,uid:user.uid,vinculos:cache.vinculos,agendamentos:cache.agendamentos});
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
 if(kind==='escola'){modal('Cadastrar escola',select('nome','Nome da instituição',schoolNames.map(n=>[n,n]))+field('inep','Código INEP')+field('telefone','Telefone')+field('endereco','Endereço')+field('email','E-mail','email'),d=>addDoc(collection(db,'escolas'),d));return}
if(kind==='profissional'){modal('Cadastrar profissional',field('nome','Nome completo','text','required')+field('nascimento','Nascimento','date')+field('cpf','CPF (quando necessário)')+field('telefone','Telefone')+field('endereco','Endereço')+field('especialidade','Especialidade')+field('email','E-mail','email')+field('uid','UID do usuário Google (após aprovação)'),async d=>{if(d.cpf&&!cpfValido(d.cpf))throw Error('CPF inválido.');const id=doc(collection(db,'profissionais'));const batch=writeBatch(db);const {cpf,telefone,endereco,nascimento,email,...base}=d;batch.set(id,{...base,uid:d.uid||'',escolas:[]});batch.set(doc(db,'profissionais_privado',id.id),{cpf,telefone,endereco,nascimento,email});await batch.commit()});return}
if(kind==='vinculo'){modal('Vincular profissional',select('profissional_id','Profissional',cache.profissionais.map(p=>[p.id,p.nome]))+schoolSelect()+field('cargo','Cargo','text','required')+field('jornada','Jornada semanal (ex.: 20 horas)')+field('uid','UID do usuário Google da profissional','text','required')+field('horarios_texto','Dias e horários (ex.: 1 08:00-12:00; 3 13:00-17:00)','text','required'),async d=>{const horarios=lerHorarios(d.horarios_texto);delete d.horarios_texto;await addDoc(collection(db,'vinculos'),{...d,horarios,ativo:true})});return}
if(kind==='aluno'){modal('Cadastrar aluno',schoolSelect()+field('nome','Nome completo','text','required')+field('nascimento','Nascimento','date','required')+field('cpf','CPF (quando necessário)')+field('matricula','Matrícula')+field('filiacao','Filiação / responsável')+field('telefone','Telefone do responsável')+field('endereco','Endereço'),async d=>{if(d.cpf&&!cpfValido(d.cpf))throw Error('CPF inválido.');const id=doc(collection(db,'alunos'));const batch=writeBatch(db);const {cpf,filiacao,telefone,endereco,...base}=d;batch.set(id,{...base,criado_por:user.uid,ativo:true});batch.set(doc(db,'alunos_privado',id.id),{cpf,filiacao,telefone,endereco,escola_id:d.escola_id,criado_por:user.uid});await batch.commit()});return}
if(kind==='usuario'){modal('Autorizar usuário',field('uid','UID do usuário pendente','text','required')+select('perfil','Perfil',[['especialista','Especialista'],['direcao','Direção escolar'],['secretaria','Secretaria de Educação']])+field('escolas','IDs das escolas autorizadas, separados por vírgula') ,async d=>{const ref=doc(db,'usuarios',d.uid);const current=await getDoc(ref);if(!current.exists())throw Error('O usuário deve fazer login com Google antes da autorização.');if(current.data().perfil==='superadmin')throw Error('Não é permitido alterar o superadministrador.');await updateDoc(ref,{perfil:d.perfil,escolas:d.escolas.split(',').map(s=>s.trim()).filter(Boolean),ativo:true})});return}
if(kind==='atendimento'||kind==='agendar'){if(!cache.alunos.length){alert('Cadastre primeiro o aluno na escola correspondente.');return}const isAgenda=kind==='agendar';modal(isAgenda?'Agendar consulta':'Atendimento imediato',schoolSelect()+select('aluno_id','Aluno',cache.alunos.map(a=>[a.id,a.nome+' — '+schoolName(a.escola_id)]))+field('inicio','Data e hora','datetime-local','required')+select('duracao_min','Duração',[[30,'30 minutos'],[60,'60 minutos']])+field('especialidade','Especialidade','text','required')+(isAgenda?'': '<label class="wide">Registro do atendimento (máximo 1.000 caracteres)<textarea name="texto" maxlength="1000" required></textarea></label>'),async d=>{const student=cache.alunos.find(a=>a.id===d.aluno_id);if(student.escola_id!==d.escola_id)throw Error('Aluno não pertence à escola selecionada.');const date=fromInputDate(d.inicio);eligible(d.inicio,d.escola_id,Number(d.duracao_min));const vinculo=cache.vinculos.find(v=>v.escola_id===d.escola_id&&v.uid===user.uid&&v.ativo===true&&dentroDaJornada(new Date(d.inicio),Number(d.duracao_min),v.horarios));if(!vinculo)throw Error('Vínculo e jornada inválidos.');const payload={...d,vinculo_id:vinculo.id,inicio:date,duracao_min:Number(d.duracao_min),autor_uid:user.uid,autor_nome:profile.nome||user.displayName,criado_em:serverTimestamp()};if(isAgenda){delete payload.texto;await addDoc(collection(db,'agendamentos'),{...payload,status:'agendado'})}else{const ref=doc(collection(db,'atendimentos'));const batch=writeBatch(db);const {texto,...meta}=payload;batch.set(ref,{...meta,data:date,status:'realizado'});batch.set(doc(db,'notas_atendimento',ref.id),{escola_id:d.escola_id,autor_uid:user.uid,texto:texto||'',atendimento_id:ref.id,revisao:1});await batch.commit()}});return}}
async function seedSchools(){
 if(!canManage())return;
 if(!confirm('Adicionar as cinco escolas iniciais sem inventar endereço, telefone ou INEP?'))return;
 const ids=['doutor-joao-souza-lima','professora-terezinha-sarmento','creche-wilma-gloria','prefeito-jose-pedro','monteiro-lobato'];
 const batch=writeBatch(db);
 for(let i=0;i<schoolNames.length;i++){
  const found=cache.escolas.some(e=>e.nome===schoolNames[i]||e.id===ids[i]);
  if(!found)batch.set(doc(db,'escolas',ids[i]),{nome:schoolNames[i],inep:'',telefone:'',endereco:'',email:''});
 }
 try{await batch.commit();await refresh();render()}catch(e){showError(e)}
}
async function registerExit(id){
 const f=cache.frequencias.find(x=>x.id===id);if(!f||f.uid!==user.uid||f.status!=='aberta')return;
 if(!confirm('Registrar saída do trabalho neste momento?'))return;
 try{await updateDoc(doc(db,'frequencias',id),{saida:serverTimestamp(),status:'fechada'});await refresh();render()}catch(e){showError(e)}
}
function openUser(uid){
 const u=cache.usuarios.find(x=>x.id===uid);if(!u||u.perfil==='superadmin')return;
 modal('Permissões de '+safe(u.nome||u.email),
 select('perfil','Perfil',[['pendente','Aguardando'],['especialista','Especialista'],['direcao','Direção escolar'],['secretaria','Secretaria de Educação'],['visualizador','Somente relatórios']])+
 '<label>Permitir acesso?<select name="ativo"><option value="true">Sim</option><option value="false">Não</option></select></label>'+
 '<div class="wide"><strong>Escolas autorizadas</strong><div class="card">'+cache.escolas.map(e=>'<label class="check-school"><input type="checkbox" name="escolas" value="'+safe(e.id)+'" '+((u.escolas||[]).includes(e.id)?'checked':'')+'> '+safe(e.nome)+'</label>').join('')+'</div></div>',
 async d=>{
  const selected=Array.from(document.querySelectorAll('#entry input[name="escolas"]:checked')).map(x=>x.value);
  if(['especialista','direcao','visualizador'].includes(d.perfil)&&d.ativo==='true'&&!selected.length)throw Error('Selecione pelo menos uma escola.');
  await updateDoc(doc(db,'usuarios',uid),{perfil:d.perfil,ativo:d.ativo==='true',escolas:selected,gerenciar:false});
 });
 const form=document.getElementById('entry');form.querySelector('[name=perfil]').value=u.perfil;form.querySelector('[name=ativo]').value=String(u.ativo===true);
}
function openEdit(id){const a=cache.atendimentos.find(x=>x.id===id);if(!a||!(a.autor_uid===user.uid||profile.perfil==='superadmin'))return;modal('Editar / cancelar atendimento','<label class="wide">Observações<textarea name="texto" maxlength="1000" required>'+safe(a.texto)+'</textarea></label>'+select('status','Situação',[['realizado','Realizado'],['cancelado','Cancelado']])+field('motivo','Justificativa da alteração','text','required'),async d=>{const batch=writeBatch(db);batch.update(doc(db,'atendimentos',id),{status:d.status,motivo_ultima_alteracao:d.motivo,alterado_por:user.uid,alterado_em:serverTimestamp()});const revision=Number(cache.notas_atendimento.find(n=>n.id===id)?.revisao||1)+1;batch.update(doc(db,'notas_atendimento',id),{texto:d.texto,revisao:revision,atualizado_em:serverTimestamp()});batch.set(doc(db,'notas_versoes',id+'-'+revision),{atendimento_id:id,escola_id:a.escola_id,autor_uid:a.autor_uid,editado_por:user.uid,texto_anterior:a.texto||'',texto_novo:d.texto,justificativa:d.motivo,versao:revision,em:serverTimestamp()});await batch.commit()});document.querySelector('#entry [name=status]').value=a.status||'realizado'}
initialize();
