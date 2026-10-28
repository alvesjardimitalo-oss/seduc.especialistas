// Funções puras: compartilhadas entre UI e testes. Nenhuma informação pessoal deve ser registrada em logs.
export const perfis = Object.freeze(['pendente','especialista','direcao','secretaria','visualizador','superadmin']);
export function normalizarCPF(valor='') { return String(valor).replace(/\D/g,''); }
export function cpfValido(valor) {
 const cpf=normalizarCPF(valor);
 if(!/^\d{11}$/.test(cpf)||/^(\d)\1{10}$/.test(cpf)) return false;
 for (let tamanho=9; tamanho<=10; tamanho++){
  const soma=[...cpf.slice(0,tamanho)].reduce((acc,n,i)=>acc+Number(n)*(tamanho+1-i),0);
  const verificador=(soma*10)%11;
  if(Number(cpf[tamanho])!==(verificador===10?0:verificador)) return false;
 }
 return true;
}
export function lerHorarios(texto) {
 const itens=String(texto).split(';').map(x=>x.trim()).filter(Boolean);
 if(!itens.length) throw Error('Informe pelo menos um dia e intervalo de trabalho.');
 return itens.map(item=>{
  const m=/^([0-6])\s+([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/.exec(item);
  if(!m) throw Error('Formato inválido: use 1 08:00-12:00; 3 13:00-17:00.');
  const inicio=Number(m[2])*60+Number(m[3]),fim=Number(m[4])*60+Number(m[5]);
  if(fim<=inicio)throw Error('O horário final deve ser posterior ao inicial.');
  if(inicio%30!==0||fim%30!==0)throw Error('As jornadas deste módulo devem ser informadas em horas cheias ou meias horas.');
  return {dia:Number(m[1]),inicio:m[2]+':'+m[3],fim:m[4]+':'+m[5]};
 });
}
const minuto=hora=>{const [h,m]=hora.split(':').map(Number);return h*60+m};
export function gerarSlotsSemana(horarios){
 const indices=new Set();
 for(const h of horarios){
  const inicio=minuto(h.inicio),fim=minuto(h.fim);
  for(let min=inicio;min+30<=fim;min+=30) indices.add(h.dia*48+min/30);
 }
 return [...indices].sort((a,b)=>a-b);
}

export function dentroDaJornada(inicio, duracaoMin, horarios) {
 const d=new Date(inicio);
 if(!Number.isFinite(d.getTime())||!Number.isInteger(duracaoMin)||duracaoMin<=0)return false;
 const atual=d.getHours()*60+d.getMinutes();
 return Array.isArray(horarios)&&horarios.some(h=>h.dia===d.getDay() && atual>=minuto(h.inicio) && atual+duracaoMin<=minuto(h.fim));
}
export function possuiConflito(inicio,duracaoMin,agendamentos,uid,ignorarId=null){
 const alvo=new Date(inicio).getTime(),fim=alvo+duracaoMin*60_000;
 return agendamentos.some(a=>{
  if(a.id===ignorarId||a.autor_uid!==uid||!['agendado','em_atendimento'].includes(a.status))return false;
  const aInicio=new Date(a.inicio).getTime(),aFim=aInicio+(Number(a.duracao_min)||30)*60_000;
  return alvo<aFim&&fim>aInicio;
 });
}
export function podeAgendar({inicio,duracaoMin=30,escolaId,uid,vinculos,agendamentos}) {
 const data=new Date(inicio);
 if(!Number.isFinite(data.getTime()))throw Error('Data inválida.');
 if(![30,60].includes(Number(duracaoMin)))throw Error('Escolha 30 ou 60 minutos.');
 if(data.getTime()<Date.now()-60_000)throw Error('Não é permitido agendar no passado.');
 const autorizados=vinculos.filter(v=>v.escola_id===escolaId&&v.uid===uid&&v.ativo===true);
 if(!autorizados.length)throw Error('Sem vínculo profissional ativo nesta escola.');
 if(!autorizados.some(v=>dentroDaJornada(data,Number(duracaoMin),v.horarios)))throw Error('Horário fora da jornada de trabalho.');
 if(possuiConflito(data,Number(duracaoMin),agendamentos,uid))throw Error('Já existe agendamento sobreposto.');
 return true;
}
export const resumirPerfil=p=>({perfil:p?.perfil||'pendente',ativo:p?.ativo===true,escolas:Array.isArray(p?.escolas)?p.escolas:[]});
