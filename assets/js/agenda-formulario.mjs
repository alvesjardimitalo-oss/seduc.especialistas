import {dentroDaJornada,possuiConflito,lerHorarios,gerarSlotsSemana} from './validacoes.mjs';
export function listarProfissionaisDaEscola({escolaId,vinculos=[],usuarios=[],profissionais=[],usuarioLogado='',gestao=false}){
 if(!escolaId)return [];
 const disponiveis=new Map();
 for(const v of vinculos){
  if(!v.ativo||v.escola_id!==escolaId||!v.uid)continue;
  if(!gestao&&v.uid!==usuarioLogado)continue;
  if(gestao){
   const conta=usuarios.find(u=>u.id===v.uid);
   if(!conta||conta.ativo!==true||conta.perfil!=='especialista'||!conta.escolas?.includes(escolaId))continue;
  }
  const conta=usuarios.find(u=>u.id===v.uid);
  const profissional=profissionais.find(p=>p.uid===v.uid);
  if(!disponiveis.has(v.uid))disponiveis.set(v.uid,{
   uid:v.uid,
   nome:conta?.nome||profissional?.nome||v.nome||v.uid,
   especialidade:profissional?.especialidade||v.cargo||'Atendimento especializado'
  });
 }
 return [...disponiveis.values()].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
}
export function horariosLivres({data='',escolaId='',uid='',duracaoMin=30,vinculos=[],agendamentos=[],agora=new Date()}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(data)||!escolaId||!uid||![30,60].includes(Number(duracaoMin)))return [];
 const jornadas=vinculos.filter(v=>v.ativo===true&&v.uid===uid&&v.escola_id===escolaId);
 if(!jornadas.length)return [];
 const horarios=[];
 for(let minutos=6*60;minutos<=22*60;minutos+=30){
  const hora=String(Math.floor(minutos/60)).padStart(2,'0')+':'+String(minutos%60).padStart(2,'0');
  const inicio=new Date(data+'T'+hora+':00');
  if(Number.isNaN(inicio.getTime())||inicio.getTime()<=agora.getTime())continue;
  if(!jornadas.some(v=>dentroDaJornada(inicio,Number(duracaoMin),v.horarios)))continue;
  if(possuiConflito(inicio,Number(duracaoMin),agendamentos.map(a=>({...a,inicio:a.inicio?.toDate?.()||a.inicio})),uid))continue;
  horarios.push({valor:hora,rotulo:hora});
 }
 return horarios;
}

export function diagnosticarProfissionaisDaEscola({escolaId,usuarios=[],vinculos=[],profissionais=[]}){
 if(!escolaId)return [];
 const candidatos=usuarios.filter(u=>(u.perfil==='especialista'&&u.ativo===true&&u.escolas?.includes(escolaId))||
  vinculos.some(v=>v.escola_id===escolaId&&v.uid===u.id&&v.ativo===true));
 return candidatos.map(conta=>{
  const ativos=vinculos.filter(v=>v.uid===conta.id&&v.escola_id===escolaId&&v.ativo===true);
  const ficha=profissionais.find(p=>p.uid===conta.id)||profissionais.find(p=>ativos.some(v=>v.profissional_id===p.id));
  let motivo='';
  if(conta.ativo!==true||conta.perfil!=='especialista')motivo='Conta sem acesso ativo de especialista';
  else if(!conta.escolas?.includes(escolaId))motivo='Conta sem autorização nesta instituição';
  else if(!ativos.length)motivo='Falta configurar vínculo e jornada nesta instituição';
  else if(!ativos.some(v=>{
   try{
    const horarios=lerHorarios((v.horarios||[]).map(h=>h.dia+' '+h.inicio+'-'+h.fim).join(';'));
    const slots=gerarSlotsSemana(horarios);
    return Array.isArray(v.slots_semana)&&slots.length>0&&slots.length===v.slots_semana.length&&slots.every(s=>v.slots_semana.includes(s));
   }catch{return false}
  }))motivo='Jornada ausente ou desatualizada; configure dias e horários';
  return {uid:conta.id,nome:conta.nome||ficha?.nome||conta.id,
   especialidade:ficha?.especialidade||ativos[0]?.cargo||'Atendimento especializado',
   habilitado:!motivo,motivo};
 }).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
}

export function avaliarAcessoConsulta({agendamento,uid,perfil,ativo}){
 if(!uid||ativo!==true)return {codigo:'sem_acesso',mensagem:'Entre com uma conta ativa para acessar a consulta.'};
 if(perfil!=='especialista')return {codigo:'consulta',mensagem:'Esta conta pode consultar a agenda. O atendimento deve ser iniciado pela especialista responsável.'};
 if(!agendamento?.autor_uid||agendamento.autor_uid!==uid)return {codigo:'outra_conta',mensagem:'Esta consulta está vinculada a outra conta de acesso. O nome exibido pode ser igual, mas os identificadores das contas são diferentes. A Secretaria deve conferir a conta selecionada ao agendar.'};
 return {codigo:'responsavel',mensagem:'Você está na conta responsável por esta consulta.'};
}
