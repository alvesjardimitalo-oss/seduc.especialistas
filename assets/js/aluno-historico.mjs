import {filtrarRegistros} from './relatorios.mjs';
export function consultasDoAluno(alunoId,atendimentos=[],agendamentos=[],filtros={}){
 const registros=[
  ...atendimentos.map(r=>({...r,tipo:'atendimento'})),
  ...agendamentos.map(r=>({...r,tipo:'agendamento'}))
 ].filter(r=>r.aluno_id===alunoId&&(!filtros.status||r.status===filtros.status)&&(!filtros.tipo||r.tipo===filtros.tipo));
 return filtrarRegistros(registros,filtros).sort((a,b)=>instante(b)-instante(a));
}
function instante(r){
 const valor=r.inicio??r.data;
 const data=valor?.toDate?valor.toDate():new Date(valor);
 return Number.isFinite(data.getTime())?data.getTime():0;
}
export function validarRelatorio({titulo,texto}){
 if(typeof titulo!=='string'||!titulo.trim()||titulo.trim().length>150)throw Error('Informe um título de até 150 caracteres.');
 if(typeof texto!=='string'||!texto.trim()||texto.trim().length>5000)throw Error('Informe o relatório com até 5.000 caracteres.');
 return {titulo:titulo.trim(),texto:texto.trim()};
}

const normalizarBusca=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
export function filtrarConsultas(registros,alunos=[],filtros={}){
 const nomes=new Map(alunos.map(a=>[a.id,normalizarBusca(a.nome)]));
 const termo=normalizarBusca(filtros.nome);
 return filtrarRegistros(registros.filter(r=>
  (!filtros.status||r.status===filtros.status)&&(!termo||(nomes.get(r.aluno_id)||'').includes(termo))
 ),filtros);
}
