// Calendário baseado no cache já carregado do Firestore; trocar dia ou mês não faz leituras.
export function diaLocal(value){
 if(!value)return '';
 const data=value?.toDate?.()||value instanceof Date&&value||new Date(value);
 if(!Number.isFinite(data.getTime()))return '';
 return data.getFullYear()+'-'+String(data.getMonth()+1).padStart(2,'0')+'-'+String(data.getDate()).padStart(2,'0');
}
export function mesLocal(ano,mes){
 const a=Number(ano),m=Number(mes);
 if(!Number.isInteger(a)||a<2020||a>2100||!Number.isInteger(m)||m<0||m>11)throw Error('Mês inválido.');
 return new Date(a,m,1);
}
export function montarGradeAgenda(ano,mes,agendamentos=[]){
 const inicio=mesLocal(ano,mes),primeiroDia=(inicio.getDay()+6)%7;
 const total=new Date(ano,mes+1,0).getDate(),celulas=[];
 const contagens=new Map();
 for(const item of agendamentos){
  const data=diaLocal(item.inicio);if(!data||data.slice(0,7)!==diaLocal(inicio).slice(0,7))continue;
  const atual=contagens.get(data)||{total:0,pendentes:0,realizados:0,faltas:0};
  atual.total++;
  if(item.status==='agendado'||item.status==='em_atendimento')atual.pendentes++;
  if(item.status==='realizado')atual.realizados++;
  if(item.status==='falta_aluno'||item.status==='falta_profissional')atual.faltas++;
  contagens.set(data,atual);
 }
 for(let i=0;i<primeiroDia;i++)celulas.push({fora:true,key:'vazio-'+i});
 for(let dia=1;dia<=total;dia++){
  const data=diaLocal(new Date(ano,mes,dia));
  celulas.push({fora:false,data,dia,key:data,...(contagens.get(data)||{total:0,pendentes:0,realizados:0,faltas:0})});
 }
 return celulas;
}
