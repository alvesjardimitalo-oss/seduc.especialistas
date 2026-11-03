# Implantação e homologação — versão 2

## 1. Firebase (projeto `seduc-especialistas`)
1. **Authentication → Sign-in method:** habilite **E-mail/senha** (login principal) e mantenha o **Google** habilitado (opcional).
   - Em **Authentication → Settings → User actions**, desmarque *Enable create (sign-up)* para que só a administração crie contas com senha.
   - Em **Authentication → Templates → Password reset**, ajuste o idioma para português; é o e-mail que a profissional recebe para criar a senha.
2. **Authentication → Settings → Authorized domains:** inclua `alvesjardimitalo-oss.github.io`.
3. **Publicar regras e índices:** no GitHub, abra Actions → *Publicar regras do Firestore SEDUC* → *Run workflow*. Escolha a branch `v2-prontuario` e digite `seduc-especialistas`.
   - O workflow roda os testes antes de publicar.
   - Ele precisa do segredo `FIREBASE_SERVICE_ACCOUNT_SEDUC`.
   - Sem o segredo, use o Console: Firestore → Regras, cole o conteúdo de `firestore.rules` e publique. Depois crie os 3 índices de `firestore.indexes.json` (o próprio Firestore mostra o link de criação no primeiro erro de consulta).
   - **Versão 2.2:** as regras ganharam as coleções `pedidos` (fila de espera), `frequencias`, `acessos` e `planos`, e o campo `metas` no registro da consulta. **Publique o `firestore.rules` novo** antes de usar essas telas; com as regras antigas elas mostram "Operação não autorizada".
4. As regras novas **substituem** as da versão anterior. A versão antiga publicada deixa de funcionar, o que é esperado, porque usa outras coleções. Os documentos antigos continuam no banco e ficam inacessíveis pelo app.

## 2. Administrador
A conta de administrador **já existe** em `usuarios/{uid}`, com `perfil: "superadmin"` e `ativo: true`, e continua valendo. Se for preciso criar outra, faça isso pelo Console do Firestore. Nunca promova automaticamente o primeiro usuário.

## 3. Publicação do site
GitHub → Settings → Pages → Branch `v2-prontuario`, pasta `/ (root)`. Depois do merge em `main`, troque para `main`.

## 4. Primeiro uso
1. **Escolas:** clique em *Adicionar as 6 escolas da rede*. Depois complete INEP, telefone e direção.
2. **Equipe:** use *+ Novo acesso* para cada especialista: nome, e-mail, especialidade e as **instituições que ela atende**.
   - Modo **E-mail e senha** (padrão): a conta é criada e a pessoa recebe um e-mail para definir a senha.
   - Modo **Google**: a pessoa entra com o Google desse e-mail.
   - Quando ela entrar, use *Editar* para definir a **jornada**: dias, horários e local de cada período.
   - Quem já entrou sem autorização aparece em *Aguardando liberação*.
3. **Direções:** autorize da mesma forma, escolhendo a(s) escola(s).
4. **Alunos:** cadastre manualmente ou use *Importar planilha (JSON)* (só a administração) com o arquivo privado de 2026. O arquivo **não** vai para o GitHub.

## 5. Teste com a equipe (dados fictícios)
- [ ] A especialista registra um atendimento, e as outras duas veem o card.
- [ ] Somente a autora consegue retificar; a versão anterior aparece em *Ver versões anteriores*.
- [ ] A direção vê data, profissional e evolução, mas não o texto.
- [ ] A direção não vê alunos de outra escola.
- [ ] Não é possível agendar fora da jornada nem em horário já ocupado.
- [ ] Cancelar libera o horário.
- [ ] O prontuário e o relatório descritivo imprimem com assinatura.
- [ ] O relatório gerencial confere com a contagem manual de um mês.

## 6. Recursos da versão 2.2
- **Fila de espera:** a direção, a Secretaria ou a equipe usam *Pedir atendimento*. A especialista agenda direto da fila; o pedido sai da fila sozinho.
- **Frequência:** a especialista registra entrada e saída (relógio do servidor, exige internet) e informa ausências com justificativa. A gestão vê horas previstas pela jornada × cumpridas e corrige com motivo. Dias bloqueados no calendário escolar não contam como previstos.
- **Registro de acessos (LGPD):** abrir, imprimir prontuário, gerar ficha ou imprimir relatório fica registrado. Consulta em *Segurança* (só administração) ou no botão *Quem acessou* do prontuário. O registro é feito pelo aplicativo; ele não substitui a política de acesso, mas dá rastreabilidade.
- **Plano de metas:** cada especialista cria até 8 metas por aluno; em cada consulta marca de 1 a 5; o prontuário mostra a evolução em gráfico e a impressão leva a tabela.
- **Sem internet:** o aplicativo abre sem conexão depois do primeiro acesso, e os dados já vistos ficam no aparelho. Consultas registradas sem internet ficam guardadas e são enviadas quando a conexão volta (o topo mostra "aguardando envio"). Agendar, editar consulta e ponto precisam de internet. **Ao clicar em Sair, a cópia local é apagada** — importante em computadores da escola.
- **Lembrete por WhatsApp:** na consulta agendada ou no painel ("Lembretes para amanhã"); o texto leva só o primeiro nome, dia, hora e escola.
- **Feriados nacionais:** Agenda → Calendário escolar → *Feriados nacionais* (inclui Carnaval, Sexta-feira Santa e Corpus Christi do ano).
- **Painel da Secretaria:** em Relatórios, gráfico dos últimos 12 meses por especialidade e a demanda reprimida por escola.

## 7. Cópia de segurança
- **Manual (navegador):** *Segurança* → *Baixar cópia criptografada*. Use uma senha de pelo menos 12 caracteres e guarde-a separada do arquivo. *Conferir uma cópia* abre o arquivo no navegador para verificar.
- **Automática (semanal):** o workflow *Cópia de segurança semanal* roda todo domingo e guarda a cópia criptografada como artefato do GitHub por 90 dias. Configure em Settings → Secrets and variables → Actions:
  - `FIREBASE_SERVICE_ACCOUNT_SEDUC` (o mesmo usado para publicar as regras);
  - `BACKUP_SENHA` (senha longa; sem ela a cópia não abre).
  Para baixar: Actions → *Cópia de segurança semanal* → execução → *Artifacts*. Para abrir no computador: `BACKUP_SENHA="..." node tools/abrir-backup.mjs copia.json saida.json` (o arquivo de saída tem dados sensíveis: apague depois de usar).
- Como o repositório é público, a cópia **nunca** é guardada sem criptografia.

## 8. Antes de usar dados reais
- Termo de responsabilidade e política de acesso definidos pela Prefeitura (LGPD, arts. 11 e 14).
- Cópia de segurança configurada (seção 7) e testada com *Conferir uma cópia*.
- Retenção: o prontuário eletrônico deve ser guardado por longo prazo (CFFa 649/2022: eliminação só após 20 anos do último registro; CFP 001/2009: mínimo de 5 anos). O sistema não apaga registros.
- Protocolos de testes psicológicos (neuropsicologia) **não** devem ser anexados ao prontuário compartilhado. Ficam sob guarda exclusiva da psicóloga (CFP 001/2009); no sistema, registre só a síntese.
