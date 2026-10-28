import {cpfValido,normalizarCPF} from './validacoes.mjs';
export const CAMPOS_PRIVADOS_ALUNO=['cpf','filiacao','telefone','endereco','mae_nome','pai_nome','pai_nao_declarado','responsavel_nome','responsavel_parentesco','responsavel_telefone','responsavel_telefone_alternativo','responsavel_email','cep','logradouro','numero','complemento','bairro','cidade','uf','referencia'];
export const nomeCompleto = valor => String(valor||'').replace(/\s+/g,' ').trim();
export const apenasDigitos = valor => String(valor||'').replace(/\D/g,'');
export function dataNascimentoValida(data,hoje=new Date()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(data||'')))return false;
 const [ano,mes,dia]=data.split('-').map(Number);
 const d=new Date(ano,mes-1,dia,12);
 const h=new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate(),12);
 return d.getFullYear()===ano&&d.getMonth()===mes-1&&d.getDate()===dia&&d<=h&&ano>=1900;
}
export function formatarCPF(valor){
 const cpf=apenasDigitos(valor).slice(0,11);
 return cpf.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/ ,'.$1-$2');
}
export function formatarCEP(valor){
 const cep=apenasDigitos(valor).slice(0,8);
 return cep.length>5?cep.slice(0,5)+'-'+cep.slice(5):cep;
}
export function formatarTelefone(valor){
 const n=apenasDigitos(valor).slice(0,11);
 if(n.length===11)return '('+n.slice(0,2)+') '+n.slice(2,7)+'-'+n.slice(7);
 if(n.length===10)return '('+n.slice(0,2)+') '+n.slice(2,6)+'-'+n.slice(6);
 return n;
}
export function enderecoCompleto(d){
 return [d.logradouro, d.numero&&('nº '+d.numero),d.complemento,d.bairro,d.cidade&&d.uf?(d.cidade+' / '+d.uf):d.cidade||d.uf,d.cep&&('CEP '+formatarCEP(d.cep))].filter(Boolean).join(', ');
}
export function prepararCadastroAluno(d,{escolaId='',criadoPor='',existente=null,privadoAnterior={}}={}){
 const nome=nomeCompleto(d.nome),nascimento=String(d.nascimento||'');
 if(nome.length<3||nome.length>180)throw Error('Informe o nome completo do aluno (até 180 caracteres).');
 if(!dataNascimentoValida(nascimento))throw Error('Informe uma data de nascimento válida, que não seja futura.');
 const mae=nomeCompleto(d.mae_nome),paiNaoDeclarado=d.pai_nao_declarado==='sim'||d.pai_nao_declarado===true;
 const pai=paiNaoDeclarado?'':nomeCompleto(d.pai_nome);
 const responsavel=nomeCompleto(d.responsavel_nome);
 const telefone=apenasDigitos(d.responsavel_telefone),alternativo=apenasDigitos(d.responsavel_telefone_alternativo);
 const cpf=normalizarCPF(d.cpf||'');
 const cep=apenasDigitos(d.cep);
 const uf=String(d.uf||'').trim().toUpperCase();
 const email=String(d.responsavel_email||'').trim();
 const escola=existente?.escola_id||escolaId||d.escola_id;
 if(!escola)throw Error('Selecione a escola do aluno.');
 if(mae.length<3||mae.length>180)throw Error('Informe o nome completo da mãe.');
 if(!paiNaoDeclarado&&(pai.length<3||pai.length>180))throw Error('Informe o nome do pai ou marque "Pai não declarado".');
 if(responsavel.length<3||responsavel.length>180)throw Error('Informe o nome do responsável pelo aluno.');
 if(telefone.length<10||telefone.length>11)throw Error('Informe o telefone do responsável com DDD.');
 if(alternativo&&(alternativo.length<10||alternativo.length>11))throw Error('Telefone alternativo inválido.');
 if(cpf&&!cpfValido(cpf))throw Error('CPF do aluno inválido. Verifique os dígitos.');
 if(cep&&cep.length!==8)throw Error('O CEP deve conter oito dígitos.');
 if(uf&&!/^[A-Z]{2}$/.test(uf))throw Error('UF inválida.');
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('E-mail do responsável inválido.');
 const dados={
  nome,nascimento,matricula:String(d.matricula||'').trim().slice(0,80),
  escola_id:escola,criado_por:existente?.criado_por||criadoPor,ativo:existente?.ativo!==false
 };
 const extra={
  cpf,filiacao:[mae,pai].filter(Boolean).join(' / '),
  telefone:formatarTelefone(telefone),
  endereco:'',
  mae_nome:mae,pai_nome:pai,pai_nao_declarado:paiNaoDeclarado,
  responsavel_nome:responsavel,responsavel_parentesco:String(d.responsavel_parentesco||'Outro').trim(),
  responsavel_telefone:formatarTelefone(telefone),responsavel_telefone_alternativo:formatarTelefone(alternativo),
  responsavel_email:email,
  cep:formatarCEP(cep),logradouro:String(d.logradouro||'').trim(),
  numero:String(d.numero||'').trim(),complemento:String(d.complemento||'').trim(),
  bairro:String(d.bairro||'').trim(),cidade:String(d.cidade||'').trim(),uf,
  referencia:String(d.referencia||'').trim(),
  escola_id:escola,criado_por:privadoAnterior?.criado_por||criadoPor
 };
 extra.endereco=enderecoCompleto(extra);
 if(!extra.logradouro||!extra.bairro||!extra.cidade||!extra.uf)throw Error('Complete o endereço: logradouro, bairro, cidade e UF.');
 if(!extra.numero)extra.numero='S/N';
 for(const [k,v] of Object.entries(extra))if(typeof v==='string'&&v.length>500)throw Error('Campo muito longo: '+k+'.');
 if(!CAMPOS_PRIVADOS_ALUNO.every(k=>Object.hasOwn(extra,k)))throw Error('Dados particulares do aluno incompletos.');
 return {publico:dados,privado:extra};
}
export async function consultarCEP(cep,fetcher=fetch){
 const n=apenasDigitos(cep);
 if(n.length!==8)throw Error('Informe um CEP com oito dígitos.');
 const resposta=await fetcher('https://viacep.com.br/ws/'+n+'/json/',{headers:{Accept:'application/json'}});
 if(!resposta.ok)throw Error('Consulta de CEP indisponível. Preencha o endereço manualmente.');
 const dados=await resposta.json();
 if(!dados||dados.erro)throw Error('CEP não encontrado. Confira o número ou preencha manualmente.');
 return {cep:formatarCEP(n),logradouro:String(dados.logradouro||''),bairro:String(dados.bairro||''),cidade:String(dados.localidade||''),uf:String(dados.uf||'')};
}
