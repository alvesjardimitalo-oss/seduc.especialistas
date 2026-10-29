import {dataRegistro} from './consultas-resumo.mjs';
const titulos={'Motivo / objetivo':'objetivo','Atividades e procedimentos':'atividades','Observações e resposta':'resposta','Orientações e encaminhamentos':'proximosPassos'};
export function separarRegistroEquipe(texto=''){
 const conteudo=String(texto),regex=/^(Motivo \/ objetivo|Atividades e procedimentos|Observações e resposta|Orientações e encaminhamentos):\s*\n/gm;
 const partes=[...conteudo.matchAll(regex)],r={objetivo:'',atividades:'',resposta:'',proximosPassos:'',integral:conteudo};
 partes.forEach((p,i)=>r[titulos[p[1]]]=conteudo.slice(p.index+p[0].length,partes[i+1]?.index??conteudo.length).trim());
 return r;
}
export function montarContinuidade(alunoId,atendimentos=[]){
 const historico=atendimentos.filter(a=>a.aluno_id===alunoId&&a.status==='realizado').slice().sort((a,b)=>dataRegistro(b.data||b.inicio)-dataRegistro(a.data||a.inicio)).map(a=>({...a,registro:separarRegistroEquipe(a.texto)}));
 const ultimos=new Map();for(const a of historico){const chave=a.autor_uid||a.id;if(!ultimos.has(chave))ultimos.set(chave,a);}
 return {historico,ultimosPorProfissional:[...ultimos.values()],profissionais:ultimos.size};
}
