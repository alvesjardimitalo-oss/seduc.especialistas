import {dentroDaJornada,possuiConflito} from './validacoes.mjs';
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
