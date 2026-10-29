export function podeGerirConsulta(consulta, pessoa) {
  if (!consulta || pessoa?.ativo !== true || !pessoa.uid) return false;
  return pessoa.perfil === 'superadmin' ||
    (pessoa.perfil === 'secretaria' && pessoa.gerenciar === true) ||
    (pessoa.perfil === 'especialista' && consulta.autor_uid === pessoa.uid);
}

export function dadosDaRemarcacao(anterior, {inicio, novoId, motivo, atorUid, em}) {
  return {
    origem: {
      status: anterior.status === 'agendado' ? 'remarcado' : anterior.status,
      novo_agendamento_id: novoId,
      remarcado_em: em,
      motivo_remarcacao: motivo,
      alterado_por_uid: atorUid,
    },
    novo: {
      escola_id: anterior.escola_id, aluno_id: anterior.aluno_id,
      vinculo_id: anterior.vinculo_id, inicio, duracao_min: anterior.duracao_min,
      especialidade: anterior.especialidade, autor_uid: anterior.autor_uid,
      autor_nome: anterior.autor_nome, criado_em: em, status: 'agendado',
      remarcado_de: anterior.id,
      ...(atorUid !== anterior.autor_uid ? {agendado_por_uid: atorUid} : {}),
    },
  };
}
