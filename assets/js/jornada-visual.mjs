// Jornada visual da equipe: dias, turnos, horas e validações.
export const DIAS_JORNADA=Object.freeze([
 {dia:1,curto:'Seg',nome:'Segunda-feira'},
 {dia:2,curto:'Ter',nome:'Terça-feira'},
 {dia:3,curto:'Qua',nome:'Quarta-feira'},
 {dia:4,curto:'Qui',nome:'Quinta-feira'},
 {dia:5,curto:'Sex',nome:'Sexta-feira'},
 {dia:6,curto:'Sáb',nome:'Sábado'},
 {dia:0,curto:'Dom',nome:'Domingo'}
]);
const minutos=hora=>{
 if(!/^([01]\d|2[0-3]):(00|30)$/.test(String(hora||'')))throw Error('Utilize horários em intervalos de 30 minutos.');
 const [h,m]=hora.split(':').map(Number);
 return h*60+m;
};
export function conferirJornadaVisual(horarios){
 if(!Array.isArray(horarios)||!horarios.length)throw Error('Selecione pelo menos um dia de atendimento.');
 const ordenados=horarios.map(h=>{
  const dia=Number(h.dia),inicio=String(h.inicio||''),fim=String(h.fim||'');
  if(!Number.isInteger(dia)||dia<0||dia>6)throw Error('Dia inválido na jornada.');
  const ini=minutos(inicio),fimMin=minutos(fim);
  if(fimMin<=ini)throw Error('O horário final deve ser posterior ao início em '+DIAS_JORNADA.find(d=>d.dia===dia).nome+'.');
  if(fimMin-ini<30)throw Error('Cada turno precisa ter ao menos 30 minutos.');
  return {dia,inicio,fim,ini,fimMin};
 }).sort((a,b)=>a.dia-b.dia||a.ini-b.ini);
 for(let i=1;i<ordenados.length;i++){
  if(ordenados[i].dia===ordenados[i-1].dia&&ordenados[i].ini<ordenados[i-1].fimMin)
   throw Error('Há horários sobrepostos em '+DIAS_JORNADA.find(d=>d.dia===ordenados[i].dia).nome+'.');
 }
 const totalMinutos=ordenados.reduce((n,h)=>n+h.fimMin-h.ini,0);
 const horas=totalMinutos/60;
 const jornada=Number.isInteger(horas)?horas+' horas semanais':horas.toLocaleString('pt-BR',{maximumFractionDigits:1})+' horas semanais';
 return {horarios:ordenados.map(({dia,inicio,fim})=>({dia,inicio,fim})),totalMinutos,jornada,dias:new Set(ordenados.map(h=>h.dia)).size};
}
export function jornadaDosCampos(campos){
 const horarios=[];
 for(const {dia} of DIAS_JORNADA){
  if(campos['dia_'+dia]!=='sim')continue;
  for(const turno of [1,2]){
   if(turno===2&&campos['turno2_'+dia]!=='sim')continue;
   horarios.push({dia,inicio:campos['inicio_'+dia+'_'+turno],fim:campos['fim_'+dia+'_'+turno]});
  }
 }
 return conferirJornadaVisual(horarios);
}
