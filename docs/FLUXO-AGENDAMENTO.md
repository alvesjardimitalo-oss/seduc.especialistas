# Agendamento e atendimento: usuário, profissional e jornada

Criar uma conta de especialista autoriza o acesso às instituições selecionadas. Para reservar consultas é necessário um vínculo ativo com jornada válida na instituição. Os dados não são concedidos automaticamente ao criar a conta.

Em Agenda → Novo agendamento, selecione a instituição. Contas de especialistas autorizadas aparecem pelo nome; contas sem vínculo ou jornada ficam sinalizadas e indisponíveis para reserva. A gestão pode usar **Configurar profissional e jornada** para associar a ficha e os dias/horários à conta existente, sem criar outro usuário ou alterar suas permissões. Depois de salvar, abra novamente o novo agendamento.

A configuração cria/atualiza ficha e vínculo no mesmo lote. O sistema continua verificando horários disponíveis, reservas simultâneas e autorização no Firestore. Contas recém-criadas e jornadas são atualizadas ao abrir um agendamento pela gestão.

No atendimento sem agendamento, a responsável é a especialista autenticada e identificada no formulário. A autoria do registro clínico não é atribuída à Secretaria ou a uma colega. Para uma consulta agendada, a responsável inicia e conclui o próprio atendimento.
