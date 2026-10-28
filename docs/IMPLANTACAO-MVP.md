# Implantação do MVP — ambiente de homologação

## Estado
Esta branch contém uma primeira interface funcional e integração Firebase, **não uma implantação homologada**. Nunca cadastre CPF, saúde ou dados reais de crianças enquanto houver pendências de segurança.

## 1. Preparar Firebase independente
1. Crie um projeto exclusivo para SEDUC Especialistas em https://console.firebase.google.com/.
2. Habilite Authentication > Google.
3. Habilite Cloud Firestore em modo produção.
4. App Web **já registrado**: a configuração fornecida da aplicação `seduc-especialistas` foi inserida em `assets/js/firebase-config.js` na branch de homologação. Não reutilize a configuração do SISDIFI.
5. Publique `firestore.rules` no Console Firestore (o arquivo local NÃO é aplicado automaticamente).
6. Em **Authentication > Settings > Authorized domains**, autorize `alvesjardimitalo-oss.github.io` se for usar GitHub Pages (sem `https://` e sem `/seduc.especialistas/`); autorize igualmente um eventual domínio oficial. O domínio `seduc-especialistas.firebaseapp.com` corresponde ao app Firebase.


## 1-A. Integração da configuração web recebida
- Projeto: `seduc-especialistas`.
- Auth domain: `seduc-especialistas.firebaseapp.com`.
- App ID: registrado em `assets/js/firebase-config.js`.
- Configuração do Firebase Web é visível no navegador; nunca adicionar arquivo de conta de serviço, credencial administrativa, CPF, matrículas reais ou observações de crianças ao repositório.
- A alteração no GitHub **não habilita automaticamente** os produtos Firebase, cria banco, publica regras, libera o domínio, promove administrador ou faz deploy do site.
- Antes do primeiro login, em **Authentication > Sign-in method > Google**, clique em habilitar, selecione e-mail de suporte e salve. Em **Firestore Database**, crie o banco em modo de produção (acesso negado por padrão). Depois publique e valide as regras da branch em ambiente de testes.
- **Somente dados fictícios** até concluir auditoria, validações de agendamento no servidor e homologação institucional.

## 2. Provisionar o superadministrador com segurança
A conta inicial **não é promovida automaticamente**, para evitar que o primeiro visitante se aproprie do sistema:
1. Entre com a conta Google escolhida no site e verifique o UID no Firebase Authentication.
2. No Firestore, edite manualmente **apenas aquela conta**, em `usuarios/{uid}`, definindo `ativo:true`, `perfil:"superadmin"`, `gerenciar:true`, `escolas:[]`. Confirme o UID e o e-mail antes de salvar.
3. Saia e entre novamente. Nunca habilite primeira-conta-vira-admin no cliente.

## 3. Publicação para testes
Abra GitHub > Settings > Pages e habilite publicação da branch de homologação `feature/mvp-especialistas` (pasta root) ou efetue deploy em hospedagem de testes. Sem Firebase configurado, o site mostra somente uma tela explicativa e não registra dados.

## 4. Configuração inicial
- Na aba Escolas, cadastre as cinco instituições listadas na especificação. INEP, telefones e endereços exigem confirmação oficial.
- As pessoas acessam a aplicação com Google e aparecem no Firestore como pendentes.
- Superadmin aprova pessoas e atribui perfis e escolas pelo módulo Usuários (etapa inicial técnica: usa UID).
- Profissional deve ter vínculo ativo, escola e horários no formato `1 08:00-12:00; 3 13:00-17:00` (domingo = 0, segunda = 1).
- Registre alunos e atendimentos somente com dados fictícios até homologação.

## 5. Limitações e bloqueios antes da produção
- Os **agendamentos** agora usam travas de meia hora gravadas atomicamente no Firestore, e as regras também comparam cada horário à grade semanal do vínculo. Cancelamentos liberam os horários. A agenda continua em homologação: faltam testes de afastamentos, feriados, fusos diferentes, mudanças de jornada e marcação simultânea de aluno com profissionais distintos. Atendimentos imediatos ainda precisam de validação específica no servidor.
- As edições de notas já geram versões imutáveis em lote, mas o histórico completo de acessos/consultas (auditoria administrativa) ainda precisa ser implementado.
- O cadastro passou a separar CPF, filiação, endereço e telefone em coleções privadas; ainda falta homologação das políticas de retenção e de consulta de cada campo.
- A gestão de usuários já apresenta a lista de pessoas autenticadas e permite atribuir perfis e escolas. A criação de usuários continua sendo por convite/login Google; falta envio de convite e fluxo de recuperação/regularização de identidade.
- Foram criados testes automatizados de regras no Firestore Emulator. É necessário completar cenários de consulta multi-escola, vínculos revogados, simultaneidade e perfis administrativos antes de homologar.
- Foi incluído um registro inicial e **declaratório** de frequência com entrada e saída carimbadas no servidor, que não substitui homologação da jornada pela chefia. Relatórios avançados, matrícula histórica, transferências, exportação, backup, política de retenção e fluxo de eliminação legal ainda não foram implementados.
- A UI não implementa todos os critérios da especificação. Há necessidade de revisão de acessibilidade e validação com a equipe da Educação.

**Portanto: esta entrega é um MVP de desenvolvimento e não deve ser liberada para uso com dados pessoais de alunos.**

## 6. Testes automatizados no GitHub
A branch contém um workflow em `.github/workflows/testes.yml` que verifica sintaxe, valida CPF/jornadas/conflitos e executa testes de permissões usando o emulador oficial do Firestore com dados fictícios. A publicação de regras em produção deve acontecer **somente após revisão e testes verdes**.

Com Node.js e Java instalados, localmente:
```bash
npm install
npm test
npm run test:rules
```

## 7. Funcionalidades presentes no protótipo
- Lista e carga assistida das cinco escolas; demais dados são informados pela Secretaria.
- Cadastro de usuários por login Google, com aprovação por perfil e escola.
- Profissionais, dados privados, vínculos e jornadas.
- Alunos, dados privados, edição e arquivamento sem exclusão de atendimentos.
- Agendamento, atendimento com nota de até 1.000 caracteres e histórico expandível.
- Textos privados das notas separados dos metadados gerenciais.
- Edição por autor/superadmin com justificativa e cópia de versão imutável.
- Frequência declaratória: entrada e saída pela hora do servidor, sem equivaler a ponto homologado.

> A verificação de sobreposição e jornada **para agendamentos de 30/60 minutos** já é aplicada nas regras do Firestore com travas transacionais. O controle de jornada presume horário municipal UTC-3 (America/Sao_Paulo); mudanças legais de fuso exigem revisão do cálculo. Outras verificações funcionais, especialmente atendimentos imediatos, afastamentos e datas bloqueadas, ainda precisam de homologação.

## 8. Agendamentos e frequência: regras de homologação
- Os agendamentos são feitos de 30 em 30 minutos; duração de 30 ou 60 minutos. Uma consulta de 60 ocupa dois intervalos.
- No cadastro de vínculo, horários da jornada usam dias 0 (domingo) a 6 (sábado) e limites de horas inteiras ou meia hora, por exemplo `1 08:00-12:00; 3 13:00-17:00`. O sistema gera os índices `slots_semana` a partir destes intervalos.
- O Firestore verifica vínculo ativo, escola, aluno, horário futuro, grade semanal e reserva atômica. Uma nova reserva que encontre horário ocupado é rejeitada pelo servidor, não somente pela interface.
- Um cancelamento da autora libera as duas reservas correspondentes (quando a duração era 60 minutos).
- A frequência do profissional registra entrada e saída com horários do servidor. O dia do registro é validado com horário de Brasília/Minas Gerais (UTC-3), para impedir a criação de batidas em datas arbitrárias.
- Cadastros de vínculo antigos (sem `slots_semana`) devem ser atualizados para garantir a autorização das consultas; o projeto foi desenvolvido sem cadastros reais até esta etapa.

## 9. Primeiro acesso e dados de homologação
1. Habilite Google em Authentication e cadastre o domínio da hospedagem em Authorized domains.
2. Crie o Firestore em modo de produção, revise e publique as regras desta branch **somente no projeto seduc-especialistas**, após os testes.
3. Disponibilize a branch em um ambiente de testes (GitHub Pages ou outro host HTTPS).
4. Ao entrar com Google pela primeira vez, uma pessoa ainda não aprovada aparece como `pendente`, com seu UID visível na tela. O acesso aos cadastros continua bloqueado.
5. Confirme a identidade do administrador e altere **manualmente apenas seu documento** para `perfil: superadmin` e `ativo: true`. O primeiro visitante nunca recebe administração automaticamente.
6. Cadastre apenas as escolas e usuários fictícios para testar telas e permissões; não inclua dados de crianças neste estágio.
