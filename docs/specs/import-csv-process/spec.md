# Feature Spec: Importação CSV — Confirmação e Processamento

**Short name**: `import-csv-process`
**Status**: Draft
**Versão**: 1.0
**Story**: 10-4 (Epic 10 — Onboarding Avançado)
**Continuação de**: Story 10-3 (`import-csv-preview`) — consome os dados validados client-side

---

## Contexto

O Admin Tenant já passou pela etapa de upload, preview e validação de um CSV de participantes (Story 10-3). Esta feature consome o resultado validado e realiza o processamento real: cria contas, adiciona membros a grupos e gera um relatório de resultado. É a última story do Epic 10 e encerra o fluxo de onboarding via CSV.

---

## User Scenarios & Testing

### P1 — Admin confirma importação e vê resultado imediato (≤100 linhas)

**Como** Admin Tenant,
**quero** confirmar a importação de uma lista de até 100 participantes validados
**para** que sejam criados e adicionados ao grupo imediatamente, sem necessidade de aguardar.

**Scenario: importação síncrona bem-sucedida**
- Dado que tenho 80 linhas válidas após o preview
- Quando clico em "Confirmar Importação"
- Então o botão mostra estado de carregamento
- E ao concluir, vejo o resumo: X importados, Y já existentes, Z pendentes de convite
- E posso expandir detalhes por linha

**Scenario: importação rejeitada por limite de plano**
- Dado que meu plano permite 100 membros e o grupo já tem 60
- Quando tento importar 50 linhas
- Então recebo mensagem acionável PT-BR informando que o import excederia o limite
- E nenhum participante é criado (rejeição total — sem import parcial)

**Scenario: botão desabilitado sem linhas válidas**
- Dado que o preview resultou em 0 linhas válidas (todos com erros)
- Quando chego à tela de confirmação
- Então o botão "Confirmar Importação" aparece desabilitado
- E há mensagem explicando que não há participantes a importar

### P2 — Admin confirma importação grande (>100 linhas) e acompanha progresso

**Como** Admin Tenant,
**quero** importar uma lista grande de participantes (ex: 500 pessoas)
**para** que o sistema processe em segundo plano enquanto continuo usando a plataforma.

**Scenario: importação assíncrona iniciada**
- Dado que tenho 350 linhas válidas
- Quando confirmo a importação
- Então recebo confirmação imediata de que o processamento foi iniciado
- E uma barra de progresso mostra o andamento em tempo real

**Scenario: polling de progresso e resultado final**
- Dado que a importação está em andamento
- Quando o processamento conclui
- Então vejo o resumo final automáticamente
- E posso baixar o relatório completo

**Scenario: falha durante processamento assíncrono**
- Dado que o processamento encontrou erro inesperado
- Quando consulto o status
- Então vejo o estado "falhou" com detalhes dos erros
- E as linhas que já foram processadas com sucesso são mantidas

### P3 — Tratamento multi-tenant por linha (regra FR03)

**Como** sistema,
**preciso** aplicar regras de multi-tenancy por linha durante o processamento
**para** respeitar o consentimento dos usuários e a integridade dos dados entre tenants.

**Scenario: e-mail novo na plataforma → conta criada**
- Dado que uma linha tem e-mail não cadastrado em nenhum tenant
- Quando processada
- Então uma conta é criada e o participante é adicionado ao grupo com papel "participante"

**Scenario: e-mail existe em outro tenant → convite enviado**
- Dado que uma linha tem e-mail de alguém cadastrado em outro tenant
- Quando processada
- Então o sistema envia convite/solicitação de consentimento (reusa fluxo Story 4-3)
- E a linha aparece no resultado como "pendente de convite"
- E nenhuma auto-vinculação ocorre sem consentimento

**Scenario: e-mail já existe neste tenant → marcado como existente**
- Dado que uma linha tem e-mail de alguém já membro deste tenant
- Quando processada
- Então a linha é marcada como "já existente" (ignorada, não é erro)
- E o participante não é duplicado

**Scenario: grupo da coluna "grupo" não encontrado no tenant**
- Dado que uma linha tem o nome de um grupo que não existe neste tenant
- Quando processada
- Então a linha falha com mensagem "Grupo '{nome}' não encontrado no tenant"

### P4 — Relatório de resultado para download

**Como** Admin Tenant,
**quero** baixar um relatório do resultado da importação
**para** ter registro auditável de cada linha processada.

**Scenario: download disponível após conclusão**
- Dado que a importação (síncrona ou assíncrona) concluiu
- Quando vejo o resumo de resultado
- Então há um link "Baixar relatório" disponível
- E o arquivo contém todas as linhas originais com colunas adicionais de status e detalhes

**Scenario: relatório com mix de resultados**
- Dado que a importação processou linhas com status variados
- Quando baixo o relatório
- Então cada linha mostra seu status (importado / já existente / convite enviado / falhou)
- E linhas com falha mostram o motivo específico

---

## Requirements

### Functional Requirements

**FR01 — Processamento síncrono (≤100 linhas)**
O sistema processa imediatamente listas de até 100 participantes validados e retorna o resultado completo na mesma requisição.

**FR02 — Processamento assíncrono (>100 linhas)**
Para listas acima de 100 participantes, o sistema inicia um job em segundo plano e retorna imediatamente com identificador para polling de progresso.

**FR03 — Regra multi-tenant por linha**
Para cada linha:
- E-mail inédito na plataforma: cria conta + adiciona ao grupo como "participante"
- E-mail em outro tenant: envia convite de consentimento via fluxo existente (Story 4-3); linha marcada como "pendente de convite"
- E-mail já neste tenant: ignorado, marcado como "já existente"
- Grupo (coluna "grupo") inexistente no tenant: linha marcada como falha com motivo legível

**FR04 — Validação de limite de plano antes do processamento**
Antes de iniciar qualquer criação, o sistema calcula o total de novos membros e rejeita o import inteiro se ultrapassar o limite do plano. A mensagem de rejeição é acionável em PT-BR e indica o limite e a quantidade que excede. Sem import parcial.

**FR05 — Payload da requisição**
O endpoint de import aceita a lista de linhas já validadas e o groupId de destino padrão como JSON — sem upload de arquivo no servidor. A validação client-side da Story 10-3 é pré-requisito.

**FR06 — Polling de progresso**
Endpoint dedicado retorna status (em processamento / concluído / falhou), percentual de progresso e resultado final quando concluído.

**FR07 — Relatório de resultado para download**
Ao concluir (síncrono ou assíncrono), o sistema disponibiliza arquivo para download contendo as linhas originais + colunas de status e detalhe de erro. Link com validade temporária.

**FR08 — Resumo de resultado na UI**
A tela exibe contadores de: importados, já existentes, convites enviados, falhas. Cada categoria é expansível para ver detalhes por linha.

**FR09 — Botão de confirmação condicional**
O botão "Confirmar Importação" só fica habilitado quando há pelo menos uma linha válida para processar.

**FR10 — Audit log e evento de domínio**
Toda importação bem-sucedida gera entrada no audit log (ação "import") e emite evento de domínio `onboarding.csv_import.completed`.

**FR11 — Autorização**
Apenas Admin Tenant pode iniciar ou consultar importações. Validação de pertencimento do grupo ao tenant é obrigatória.

### Key Entities

**ImportRequest** — payload enviado pelo Admin: lista de linhas validadas, groupId de destino padrão, tenant (resolvido via contexto)

**ImportResult** — resultado por linha: e-mail, nome, grupo destino, ação tomada (created / existing / invited / failed), motivo (em caso de falha)

**ImportResultSummary** — agregado: total, importados, existentes, convites, falhas, link do relatório, jobId (se assíncrono)

**ImportJobStatus** — estado do job assíncrono: jobId, status (processing / completed / failed), progresso percentual, resultado parcial/final

---

## Success Criteria

1. Admin completa o fluxo de confirmação de importação (≤100 linhas) em menos de 30 segundos do clique até exibir o resumo de resultado.
2. Importações de até 500 participantes concluem em menos de 5 minutos no modo assíncrono, com progresso visível ao Admin.
3. Zero participantes são criados automaticamente em outro tenant sem consentimento explícito — regra FR03 tem cobertura de teste de isolamento.
4. Importações que excedem o limite do plano são integralmente rejeitadas antes de criar qualquer registro, com mensagem de erro compreensível pelo Admin não-técnico.
5. 100% das importações concluídas têm entrada no audit log e relatório de resultado disponível para download.
6. O botão de confirmação permanece desabilitado enquanto não há linhas válidas — verificado por teste automatizado.

---

## Decisões de Infraestrutura

**SCHED**: Jobs assíncronos processados por worker BullMQ com polling via endpoint dedicado. Fila nomeada sem prefixo reservado (`:` proibido). Resultado armazenado em Redis pelo TTL padrão do job.

**IDEMP**: Import identificado por jobId único gerado no servidor. Retry do polling é idempotente — não re-processa, apenas consulta status.

**LOCK**: Import serializado por tenant/grupo para evitar condição de corrida em limite de plano (validação de limite ocorre dentro da transação de criação via serviço existente).

**BACKUP**: Resultado de import disponível via link temporário (signed URL com validade de 24h). Não persiste histórico de imports como tabela — resultado vive no relatório gerado.

---

## Fora de Escopo

- Import de outros tipos de entidade que não participantes (grupos, trilhas)
- Upload de arquivo CSV diretamente pelo endpoint de import (o arquivo é parseado client-side na Story 10-3)
- Importação em lote de múltiplos grupos simultaneamente (um grupo destino por importação)
- Notificações por e-mail ao Admin sobre conclusão do job assíncrono (Post-MVP)
- Histórico de importações anteriores persistido como recurso consultável (Post-MVP)
- Desfazer importação (rollback) após conclusão

## Clarifications

_Todas as decisões críticas já estão fixadas em `RECONCILIACAO-EPIC10.md` §0/§5/§6/§8/§10. Nenhuma ambiguidade remanescente requer clarificação humana._
