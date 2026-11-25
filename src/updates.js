// Histórico de atualizações exibido na página "Atualizações".
// Cada nova alteração do sistema deve ser registrada no topo desta lista.
export const updates = [
  {
    date: "2026-11-25",
    title: "Anotação sigilosa da neuropsicologia",
    items: [
      "Novo campo \"Anotação sigilosa\" (até 1.000 caracteres) no registro de atendimento, exibido apenas para a neuropsicóloga que realizou a consulta.",
      "A anotação fica guardada separada do prontuário: não aparece para as demais especialistas, direção, secretaria ou administração, nem em relatórios e impressões.",
      "Também disponível no \"Registrar grupo\", individualmente para cada aluno.",
    ],
  },
  {
    date: "2026-11-25",
    title: "Consulta em grupo com registro individual",
    items: [
      "Na Agenda, ao agendar consulta, marque \"Consulta em grupo\" para incluir mais de um aluno da mesma escola no mesmo horário.",
      "A consulta continua sendo uma só: o horário da especialista é reservado uma vez para todo o grupo.",
      "O registro de atendimento é individual: cada aluno tem o seu, no próprio prontuário.",
      "Novo botão \"Registrar grupo\" na Agenda: uma única tela com um campo para cada aluno, para registrar todos de uma vez.",
      "Cada aluno mantém a própria situação (presença, falta, cancelamento). Cancelar um aluno não desmarca os demais.",
      "Relatórios: cada aluno conta como um atendimento; as horas da especialista contam uma vez por consulta.",
    ],
  },
];
