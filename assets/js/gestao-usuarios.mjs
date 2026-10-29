const papeis=['pendente','especialista','direcao','secretaria','visualizador','superadmin'];
export const gestaoHabilitada=u=>u?.ativo===true&&!u.excluido&&(u.perfil==='superadmin'||(u.perfil==='secretaria'&&u.gerenciar===true));
export function podeEditarConta(ator,alvo){return gestaoHabilitada(ator)&&(ator.perfil==='superadmin'||(alvo.id!==ator.id&&alvo.perfil!=='superadmin'&&!alvo.gerenciar));}
export function prepararPermissoes(ator,alvo,campos,escolas){
 if(!podeEditarConta(ator,alvo))throw Error('Sem permissão para editar esta conta.');
 const nome=String(campos.nome||'').trim(),perfil=campos.perfil,ativo=campos.ativo===true||campos.ativo==='true';
 if(nome.length<3||nome.length>180)throw Error('Informe um nome entre 3 e 180 caracteres.');
 if(!papeis.includes(perfil))throw Error('Perfil inválido.');
 const gerenciar=perfil==='superadmin'||(perfil==='secretaria'&&(campos.gerenciar===true||campos.gerenciar==='true'));
 if(ator.perfil!=='superadmin'&&(perfil==='superadmin'||gerenciar))throw Error('Somente a administração pode delegar gerenciamento.');
 if(alvo.id===ator.id&&(perfil!=='superadmin'||!ativo))throw Error('Não é permitido remover o próprio acesso administrativo.');
 const ids=[...new Set(escolas)];if(ids.length>50||ids.some(x=>typeof x!=='string'||!x||x.length>128))throw Error('Escolas inválidas.');
 if(ativo&&['especialista','direcao','visualizador'].includes(perfil)&&!ids.length)throw Error('Selecione pelo menos uma escola.');
 return {nome,perfil,ativo,gerenciar,escolas:ids,excluido:campos.restaurar===true?false:Boolean(alvo.excluido)};
}
export function prepararVinculoConta(uid,dados,{aplicar=false,especialidade='',fichaId='',fichas=[],vinculos=[],horarios=[],jornada='',slots=[]}={}){
 const existentes=vinculos.filter(v=>v.uid===uid&&v.ativo===true),clinico=dados.ativo&&!dados.excluido&&dados.perfil==='especialista';
 const encerrar=existentes.filter(v=>!clinico||!dados.escolas.includes(v.escola_id)).map(v=>v.id);
 if(!clinico)return{encerrar,ficha:null,novos:[]};
 if(!aplicar){if(!dados.escolas.every(id=>existentes.some(v=>v.escola_id===id)))throw Error('Configure a ficha profissional e a jornada para as escolas selecionadas.');return{encerrar,ficha:null,novos:[]};}
 especialidade=String(especialidade).trim();if(!especialidade||especialidade.length>150)throw Error('Informe a especialidade.');
 if(!horarios.length||!slots.length)throw Error('Selecione os dias e os horários de trabalho.');
 const ficha=fichaId?fichas.find(p=>p.id===fichaId):fichas.find(p=>p.uid===uid);
 if(fichaId&&!ficha)throw Error('Ficha profissional não encontrada.');
 if(ficha?.uid&&ficha.uid!==uid)throw Error('Esta ficha pertence a outra conta.');
 const profissionalId=ficha?.id||'usuario_'+uid,novos=[];
 for(const escola of dados.escolas){
  const atuais=existentes.filter(v=>v.escola_id===escola),igual=atuais.find(v=>v.profissional_id===profissionalId&&v.cargo===especialidade&&JSON.stringify(v.horarios)===JSON.stringify(horarios));
  for(const v of atuais)if(v.id!==igual?.id)encerrar.push(v.id);
  if(!igual)novos.push({profissional_id:profissionalId,uid,escola_id:escola,cargo:especialidade,jornada,horarios,slots_semana:slots,ativo:true});
 }
 return{encerrar:[...new Set(encerrar)],ficha:{id:profissionalId,nome:dados.nome,uid,especialidade,escolas:dados.escolas},novos};
}
