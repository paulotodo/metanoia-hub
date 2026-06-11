# Feature Specification: Busca Full-Text de Trilhas e Aulas

**Feature**: `trilhas-busca`
**Created**: 2026-06-11
**Status**: Draft
**Epic**: 8 — Content (Story 8-8)

## Clarifications

### Session 2026-06-11

- Q: Qual o formato de serialização do trecho destacado (highlight) no campo `snippet` da resposta JSON? → A: Tags HTML `<b>termo</b>` geradas pelo `ts_headline` do PostgreSQL (StartSel='<b>', StopSel='</b>'). O FE renderiza com `dangerouslySetInnerHTML` em contexto controlado (campo de busca, sem input de usuário no conteúdo).
- Q: Como o sistema deve tratar aulas de trilhas com status `archived` nos resultados de busca? → A: Trilhas arquivadas (`archived`) são tratadas como `published` para efeito de visibilidade — aparecem para todos os papéis sem indicação especial. `archived` não implica restrição de visibilidade adicional; apenas `draft` tem regra diferenciada (FR-007/FR-008).
- Q: Qual o limite de resultados retornados por chamada de busca (paginação)? → A: Top 20 resultados por chamada, sem paginação. O parâmetro `limit` padrão é 20 e não configurável pelo cliente nesta versão. Paginação pode ser adicionada incrementalmente se necessário.

## User Scenarios & Testing

### User Story 1 - Busca por aulas relevantes (Priority: P1)

Como **participante, líder ou administrador**, quero buscar aulas por palavras-chave e receber resultados ordenados por relevância, para localizar rapidamente conteúdos específicos dentro do catálogo de trilhas da minha organização.

**Why this priority**: É o fluxo central da feature — sem busca funcional, nenhum outro cenário tem valor. Atende ao caso de uso mais frequente: usuário sabe aproximadamente o que quer e digita um termo.

**Independent Test**: Com pelo menos uma aula cadastrada cujo nome ou tags contenham o termo buscado, verificar que o resultado aparece com nome da aula, nome do módulo, nome da trilha e tipo de conteúdo. Independe de autenticação sofisticada ou regras de rascunho.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado com aulas publicadas na sua organização, **When** ele busca por um termo presente no nome de uma aula, **Then** o sistema retorna a aula com nome da aula, nome do módulo, nome da trilha, tipo de conteúdo e trecho destacado com o termo encontrado.

2. **Given** um usuário autenticado, **When** ele busca por um termo com acento (ex: "educação") ou sem acento (ex: "educacao"), **Then** o sistema retorna os mesmos resultados — a busca é insensível a diacríticos.

3. **Given** um usuário autenticado, **When** ele busca por um prefixo de palavra (ex: "disc" para "discipulado"), **Then** o sistema retorna aulas cujos termos começam com esse prefixo.

4. **Given** um usuário autenticado, **When** nenhuma aula corresponde ao termo buscado, **Then** o sistema retorna uma lista vazia sem mensagem de erro.

5. **Given** um usuário autenticado, **When** há múltiplos resultados, **Then** o sistema apresenta os resultados ordenados por relevância textual (mais aderentes ao topo).

---

### User Story 2 - Visibilidade de rascunhos por papel (Priority: P2)

Como **líder ou administrador**, quero visualizar também as aulas em rascunho nos resultados de busca (identificadas com indicação visual), para poder localizar conteúdo em preparação antes da publicação.

**Why this priority**: Depende da busca básica (P1) funcionar. A diferenciação de visibilidade por papel é uma regra de negócio crítica para não expor rascunhos a participantes, mas é um comportamento incremental sobre P1.

**Independent Test**: Com uma aula em status "rascunho" e um participante e um líder autenticados no mesmo tenant, verificar que o participante não recebe a aula no resultado enquanto o líder a recebe com indicação de "Rascunho".

**Acceptance Scenarios**:

1. **Given** um participante autenticado e uma aula cujo módulo pertence a uma trilha em rascunho, **When** ele busca por termos que correspondem a essa aula, **Then** o resultado não inclui a aula de trilha em rascunho.

2. **Given** um líder ou administrador autenticado e uma aula em trilha de rascunho, **When** ele busca por termos correspondentes, **Then** o resultado inclui a aula com indicação clara de que pertence a conteúdo em rascunho.

3. **Given** qualquer usuário autenticado, **When** uma aula foi removida logicamente (soft-deleted), **Then** ela não aparece em nenhum resultado de busca, independente do papel.

---

### User Story 3 - Isolamento de dados entre organizações (Priority: P3)

Como **participante, líder ou administrador**, quero que minha busca retorne apenas conteúdo da minha própria organização, para que dados de outras organizações nunca sejam expostos.

**Why this priority**: Requisito de segurança e multi-tenancy, mas independe de completude das outras stories para ser verificável isoladamente.

**Independent Test**: Com dois tenants distintos, cada um com aulas de nomes idênticos, verificar que a busca de um usuário do Tenant A retorna apenas as aulas do Tenant A.

**Acceptance Scenarios**:

1. **Given** dois tenants com aulas de nomes idênticos, **When** um usuário do Tenant A busca pelo nome compartilhado, **Then** ele recebe apenas as aulas do Tenant A, nunca do Tenant B.

2. **Given** um usuário autenticado cujo token identifica o Tenant A, **When** ele realiza qualquer busca, **Then** o sistema aplica o filtro de organização automaticamente — o usuário não pode especificar ou alterar o tenant na requisição.

---

### User Story 4 - Campo de busca integrado à navegação de trilhas (Priority: P4)

Como **participante, líder ou administrador**, quero usar um campo de busca na área de trilhas da plataforma para encontrar conteúdo sem precisar navegar manualmente pela hierarquia de trilhas e módulos.

**Why this priority**: Interface que expõe a capacidade ao usuário final. Depende da API de busca (P1–P3) para funcionar, mas a ausência dessa interface não impede a validação do backend.

**Independent Test**: Com a interface renderizada e um servidor de API disponível (ou mockado), verificar que digitar um termo no campo de busca exibe resultados com nome da aula, módulo, trilha e tipo de conteúdo, e que o campo com termo vazio não exibe resultados anteriores.

**Acceptance Scenarios**:

1. **Given** um usuário na área de trilhas, **When** ele digita um termo no campo de busca, **Then** a interface exibe os resultados de busca com nome da aula, nome do módulo, nome da trilha e tipo de conteúdo.

2. **Given** resultados de busca exibidos, **When** o usuário limpa o campo de busca, **Then** a lista de resultados é limpa sem erros.

3. **Given** uma busca sem resultados, **When** o campo retorna vazio, **Then** a interface exibe uma mensagem pastoral de estado vazio (em português, sem termos técnicos de erro).

---

### Edge Cases

- O que acontece quando o termo buscado contém caracteres especiais (aspas, parênteses)? O sistema deve retornar resultado vazio ou lista limitada, nunca erro 500.
- Como o sistema lida com termos muito curtos (1 caractere)? O sistema aplica busca por prefixo e retorna o que for encontrado, sem rejeitar a query.
- O que acontece quando uma aula é atualizada após a indexação? O sistema re-indexa automaticamente na próxima modificação do registro.
- O que acontece se o índice de busca estiver temporariamente inconsistente? O sistema retorna o que está indexado sem falhar — eventual consistency é aceitável.
- Uma aula que pertence a um módulo cujo módulo pertence a uma trilha excluída logicamente (soft-deleted em qualquer nível): não deve aparecer nos resultados.

## Requirements

### Functional Requirements

- **FR-001**: O sistema DEVE indexar automaticamente o nome e as tags de cada aula ao criar ou atualizar um registro, excluindo aulas marcadas como removidas logicamente.
- **FR-002**: O sistema DEVE suportar busca insensível a diacríticos — termos com e sem acentuação devem retornar os mesmos resultados.
- **FR-003**: O sistema DEVE suportar busca por prefixo de palavra — um prefixo de um termo deve corresponder a registros cujas palavras começam com esse prefixo.
- **FR-004**: O sistema DEVE ranquear os resultados de busca por relevância textual, apresentando os mais aderentes primeiro.
- **FR-005**: Os resultados de busca DEVEM incluir: nome da aula, nome do módulo ao qual pertence, nome da trilha ao qual pertence, tipo de conteúdo, e trecho do texto com o termo encontrado destacado em HTML (`<b>termo</b>`) gerado por `ts_headline`. O campo `snippet` é serializado como string HTML e renderizado pelo FE com `dangerouslySetInnerHTML`.
- **FR-006**: O sistema DEVE restringir os resultados ao escopo da organização do usuário autenticado — nenhum resultado de outro tenant pode aparecer.
- **FR-007**: Participantes NÃO DEVEM visualizar aulas cujas trilhas estão em status de rascunho.
- **FR-008**: Líderes e administradores DEVEM visualizar aulas de trilhas em rascunho, com indicação do status de rascunho nos resultados.
- **FR-009**: Aulas removidas logicamente (soft-deleted) NÃO DEVEM aparecer em nenhum resultado de busca, independente do papel do usuário.
- **FR-010**: Quando nenhum resultado é encontrado, o sistema DEVE retornar uma resposta de sucesso com lista vazia — nunca um erro.
- **FR-011**: O sistema DEVE manter o índice de busca isolado por organização — não é possível atravessar o limite do tenant via busca.
- **FR-012**: O sistema DEVE responder a buscas com até 10.000 aulas indexadas dentro do limite de desempenho esperado para a operação. O endpoint retorna no máximo 20 resultados por chamada (top-20 por relevância). Paginação não está no escopo desta versão.
- **FR-013**: Trilhas com status `archived` são tratadas como `published` para efeito de visibilidade nos resultados de busca — sem restrição adicional. Apenas trilhas com status `draft` aplicam regra diferenciada (FR-007/FR-008).

> Decisões de infraestrutura: a feature adiciona um índice de busca persistido no banco de dados (gerenciado por trigger automático). Não envolve scheduling periódico, rotação de chaves, refresh de token externo ou mutex multi-pod adicionais além do que já existe na plataforma.

### Key Entities

- **Resultado de busca**: representa uma aula encontrada, composta por nome da aula, nome do módulo, nome da trilha, tipo de conteúdo e trecho destacado com o(s) termo(s) encontrado(s). Não é uma entidade persistida — é derivada em tempo de consulta.
- **Índice de busca (search_vector)**: representação interna derivada do nome e das tags de cada aula, mantida automaticamente pelo sistema a cada inserção ou atualização de aula. Reflete apenas aulas não removidas logicamente.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Buscas com até 10.000 aulas indexadas retornam resultados em menos de 500ms em condições normais de operação.
- **SC-002**: Uma busca por um termo com acento e o mesmo termo sem acento retornam exatamente o mesmo conjunto de resultados.
- **SC-003**: Uma busca por prefixo de 3 letras ou mais retorna todas as aulas cujas palavras do nome ou tags começam com esse prefixo.
- **SC-004**: Um participante nunca recebe no resultado da busca aulas de trilhas em rascunho, mesmo que a mesma aula seja visível para líderes e administradores.
- **SC-005**: Um usuário do Tenant A nunca recebe no resultado da busca conteúdo do Tenant B, mesmo que ambos tenham aulas com nomes idênticos.
- **SC-006**: Uma aula removida logicamente não aparece em resultados de busca de nenhum usuário em menos de 1 minuto após a remoção (após a próxima atualização do registro que ativa o trigger).
- **SC-007**: Uma busca sem correspondências retorna resposta com lista vazia em menos de 200ms.
