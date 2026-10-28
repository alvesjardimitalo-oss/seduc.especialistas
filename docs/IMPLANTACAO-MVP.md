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

## 10. Quadro de servidores 2026 (importação local e privada)
A planilha de funcionários por escola de 2026 foi convertida para um JSON privado com **248 servidores e 6 instituições**, não enviado ao GitHub. A instituição **Wilma Glória** é corretamente classificada como **Creche Municipal Wilma Glória Nunes Mourão** (79 servidores), mesmo que a planilha a chame de escola ou ensino infantil. A **Creche Sebastiana Duarte Cabral** é a sexta instituição (19 servidores). O nome original da instituição permanece registrado no campo `escola_origem`, mas o vínculo aponta ao cadastro normalizado da creche.

Com conta `superadmin` ou de Secretaria com delegação de gestão:
1. Atualize a versão de testes da branch `feature/mvp-especialistas`; confirme a publicação das regras `firestore.rules` mais recentes no Firestore, pois as novas coleções só serão autorizadas após a publicação dessas regras.
2. Acesse **Escolas → Adicionar escolas iniciais**. Serão criadas as seis instituições; as duas creches receberão `tipo: "creche"`. Para creche Wilma Glória já criada com ID correto, a função também ajusta seu tipo.
3. Acesse **Servidores → Importar arquivo de servidores (JSON)**; selecione o arquivo privado `seduc_servidores_2026_importacao_revisada.json` entregue fora do repositório.
4. Revise a contagem exibida (248 servidores; 79 na Wilma Glória) e confirme. A importação usa lotes pequenos com documentos de ID estável, pula servidores já existentes e separa o nome/cargo dos contatos `servidores_privado`.
5. Se houver erro de conexão, selecione o mesmo arquivo novamente; os registros existentes serão preservados e serão inseridos somente os faltantes.

**Segurança:** a importação **não cria contas Google**, não concede privilégios e não transforma todo servidor escolar em especialista de atendimento. A agenda profissional continua exigindo um vínculo cadastrado à parte e liberação de acesso. Nomes e telefones de servidores não podem ser armazenados no GitHub público. A planilha enviada contém funcionários, **não alunos**; a importação de alunos dependerá de outro arquivo, revisão jurídica/LGPD e homologação de acesso.

## 11. Correção de importação e alunos especiais (homologação)
- A importação dos 248 servidores passou a reconhecer o nome das escolas existentes mesmo quando seus IDs do Firestore foram gerados automaticamente. A gravação usa o ID real encontrado, sem recriar ou excluir a escola.
- A aba **Alunos** agora oferece **Importar alunos (JSON)** apenas para o `superadmin`. O arquivo local `seduc_alunos_especiais_2026_importacao_privada.json` contém 74 alunos de quatro instituições. A importação mostra o mapeamento das escolas antes de qualquer gravação.
- O documento básico `alunos/{id}` armazena somente dados mínimos para identificação; `alunos_privado/{id}` guarda campos familiares privados, e `alunos_necessidades/{id}` guarda os registros educacionais específicos separados dos relatórios gerenciais. As regras permitem a leitura dessa última coleção apenas para o superadmin e especialistas autorizados na instituição.
- Cada aluno novo é criado por lote com seus documentos separados; IDs já existentes são preservados, possíveis colisões de nome/escola geram alerta, e a importação pode ser retomada caso haja interrupção.
- **Publicar as regras `firestore.rules` mais recentes no Console Firebase antes de usar os botões de importação.** Alterações somente no GitHub não alteram as permissões já publicadas no Firestore.
- Os dados dos arquivos privados **não foram enviados ao GitHub**, e a atualização do código **não representa importação executada no banco**. Essa importação usa a sessão Google autorizada pelo Firebase no navegador, exige confirmação e depende da publicação das regras.
- Não utilizar os registros educacionais importados como diagnóstico médico ou laudo clínico. A produção com dados pessoais de menores demanda homologação da política institucional de LGPD e de acesso.

## 12. Relatórios filtrados
- Filtros combinados por data inicial/final, instituição, profissional e especialidade, com opção de limpar.
- Datas inclusivas no horário municipal (America/Sao_Paulo), inclusive quando o Firestore retorna Timestamp.
- Indicadores e tabela por instituição seguem a mesma seleção; alunos são contados de forma distinta nos atendimentos realizados. Cancelamentos não entram nos realizados.
- Os relatórios utilizam apenas os registros já disponíveis para a conta, sem novas permissões de leitura. A homologação visual com uma sessão autorizada ainda é necessária.

## 13. Ficha do aluno, consultas e acompanhamento pela Secretaria
- Em Alunos, **Ficha / consultas / relatórios** abre o histórico individual. Consultas e atendimentos têm filtros de período, profissional, especialidade, situação e tipo.
- Agenda e Atendimentos têm filtros por nome do aluno (busca sem distinção de acentos), profissional, escola/local, data inicial e final. Para um dia específico, repita a data nos dois limites.
- Na ficha do aluno, a especialista com vínculo ativo pode emitir um relatório de texto simples de até 5.000 caracteres. Relatórios ficam vinculados ao aluno, com autoria e data do servidor. Complementos geram novo relatório, preservando documentos anteriores.
- A Secretaria ativa pode consultar relatórios individuais e fichas profissionais mínimas. As observações privadas das consultas continuam com suas restrições existentes.
- Para cadastrar profissionais, adicionar vínculos, redefinir local/jornada ou retirar vínculos, a conta da Secretaria deve ter a delegação administrativa **gerenciar: true**, atribuída pelo superadministrador. Não há promoção automática de contas.
- Redefinir local/jornada encerra o vínculo antigo e cria outro atomicamente. Retirar um vínculo marca-o como inativo. Histórico e relatórios não são apagados; consultas futuras já existentes permanecem no local original e devem ser revistas na agenda.
- **As novas regras firestore.rules precisam ser publicadas no Firebase antes do uso dos relatórios individuais.** Este commit não publica regras nem altera permissões de contas existentes no banco.
- As regras adicionadas são protótipos com testes de autorização; dependem de revisão e homologação antes de uso amplo. A validação visual com sessão autorizada continua necessária.

## 14. Metas individuais, gráficos e tutorial
- A Secretaria com delegação de gestão e as especialistas com vínculo ativo podem definir metas individuais na ficha do aluno. Cada meta tem objetivo, ponto de partida, critério de alcance e prazo de revisão.
- A evolução é registrada pela equipe ou Secretaria gestora com situação (definida, em desenvolvimento, atingida, requer revisão), evidência, autoria e data do servidor. Metas redefinidas e revisões anteriores permanecem preservadas.
- Metas e revisões ficam nas coleções protegidas metas_alunos e revisoes_metas. Publicar as regras desta versão antes do uso. Contas da Secretaria sem gestão consultam os dados; não criam metas.
- Relatórios incluem gráficos de atendimentos por mês, especialidade e profissional. Os filtros permitem selecionar aluno, instituição, profissional e período. A ficha individual também mostra gráficos e a situação das metas.
- O módulo Tutorial descreve organização da agenda, ponto de partida, critérios individuais, evidências e revisão de planos. Ele orienta o uso do sistema; não prescreve tratamento.
- Apoio ao acompanhamento é uma análise automática local e explicável de prazos vencidos, metas sem revisão e faltas. Não há envio de dados a modelos externos, geração de diagnóstico clínico nem escala universal de desenvolvimento. A quantidade de consultas não é usada como medida de desenvolvimento.
- Qualquer futura integração de IA clínica exige definição do serviço, validação profissional, governança dos dados e verificação institucional antes de receber informações de crianças. Referência de supervisão humana: https://www.unesco.org/en/legal-affairs/recommendation-ethics-artificial-intelligence.
