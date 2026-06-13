# Feature Specification: Importação CSV — Upload, Preview e Validação

**Feature**: `import-csv-preview`
**Created**: 2026-06-13
**Status**: Draft
**Epic**: 10 — Onboarding Avançado
**Story**: 10-3

> **Escopo**: esta feature cobre EXCLUSIVAMENTE as etapas de upload, preview e
> validação de arquivos CSV/XLSX para importação de participantes. A confirmação
> e o processamento real da importação são responsabilidade da Story 10-4
> (`import-csv-confirm`), que está fora deste escopo.

---

## User Scenarios & Testing

### User Story 1 — Selecionar e fazer upload do arquivo de participantes (Priority: P1)

O Admin Tenant quer popular um grupo rapidamente importando uma lista de
participantes a partir de uma planilha CSV ou XLSX que já usa no dia a dia
(geralmente exportada do Excel com encoding BR). Ele acessa a área de
importação do grupo, arrasta o arquivo (ou usa o seletor de arquivo) e
recebe confirmação visual de que o arquivo foi aceito antes de qualquer
processamento.

**Why this priority**: É a porta de entrada da funcionalidade inteira. Sem
upload funcional, nenhuma outra story desta feature é possível.

**Independent Test**: Verificar que um arquivo CSV ou XLSX válido pode ser
selecionado e aceito (confirmação visual), sem nenhum processamento real.

**Acceptance Scenarios**:

1. **Given** o Admin está na página de importação do grupo, **When** ele
   arrasta um arquivo `.csv` de até 5 MB para a zona de drop, **Then** a
   zona exibe confirmação visual (nome do arquivo, tamanho, ícone de sucesso)
   e habilita o botão de avançar.

2. **Given** o Admin está na página de importação, **When** ele arrasta um
   arquivo `.xlsx` de até 5 MB, **Then** o sistema aceita o arquivo da mesma
   forma que aceita CSV.

3. **Given** o Admin tenta fazer upload de um arquivo maior que 5 MB, **When**
   o arquivo é solto na zona de drop, **Then** o sistema exibe mensagem de
   erro clara em PT-BR indicando o limite de tamanho, sem processar o arquivo.

4. **Given** o Admin tenta fazer upload de um arquivo com extensão não
   suportada (ex: `.pdf`, `.xls` antigo), **When** o arquivo é solto, **Then**
   o sistema exibe mensagem de erro indicando quais formatos são aceitos.

5. **Given** a zona de drop está visível, **When** o Admin clica em "Baixar
   template", **Then** um arquivo CSV modelo com as colunas corretas é baixado
   imediatamente, sem requisição de rede (arquivo gerado no cliente).

---

### User Story 2 — Visualizar preview e validação inline das linhas (Priority: P2)

Após selecionar o arquivo, o Admin quer ver uma amostra das linhas antes de
confirmar a importação, com indicações visuais claras de quais linhas têm
problemas críticos (ex: e-mail inválido) ou avisos (ex: participante já
existe no grupo). A pré-visualização permite que ele decida se quer corrigir
a planilha antes de prosseguir.

**Why this priority**: Sem preview, o Admin importaria às cegas e só
descobriria erros após o processamento — o que degrada a experiência e gera
retrabalho.

**Independent Test**: Com um arquivo CSV contendo linhas válidas, inválidas e
com avisos, verificar que a tabela de preview mostra cada linha com o status
visual correto (sem confirmar importação).

**Acceptance Scenarios**:

1. **Given** um arquivo CSV válido foi selecionado, **When** o parse
   client-side conclui, **Then** a tabela de preview exibe até 10 linhas com
   colunas (Nome, E-mail, Telefone, Papel no grupo), status por linha e um
   resumo acima (ex: "23 linhas lidas — 20 válidas, 2 críticas, 1 aviso").

2. **Given** uma linha tem e-mail em formato inválido, **When** a tabela de
   preview é exibida, **Then** essa linha aparece marcada com indicador crítico
   e texto descritivo do problema (ex: "E-mail inválido"), impedindo importação
   enquanto existir ao menos 1 crítico.

3. **Given** um e-mail de participante já existe no tenant, **When** o check de
   e-mails retorna do servidor, **Then** essa linha exibe indicador de aviso
   (não crítico) com mensagem "Participante já cadastrado neste grupo" —
   o Admin pode prosseguir mesmo com avisos.

4. **Given** o arquivo tem mais de 10 linhas, **When** a tabela de preview é
   exibida, **Then** mostra as primeiras 10 linhas e indica o total de linhas
   fora da amostra (ex: "Mostrando 10 de 47 linhas").

5. **Given** o arquivo foi parseado e tem pelo menos uma linha crítica, **When**
   o Admin tenta avançar, **Then** o botão de confirmar importação permanece
   desabilitado com explicação visual do motivo.

---

### User Story 3 — Suporte a encodings de CSVs exportados do Excel BR (Priority: P3)

O Admin que gera planilhas no Excel brasileiro frequentemente obtém arquivos
com encoding ISO-8859-1 ou Windows-1252, com caracteres acentuados corrompidos
se lidos como UTF-8. O sistema deve detectar automaticamente o encoding e
exibir nomes com acentos corretamente, sem exigir que o Admin saiba o que é
encoding.

**Why this priority**: Falha de encoding transforma "João" em "Jo�o" — destrói
a confiança do Admin na ferramenta mesmo quando os dados estão corretos.

**Independent Test**: Fazer upload de um CSV ISO-8859-1 com nomes acentuados
(ex: "Natália", "José") e verificar que o preview exibe os caracteres corretos.

**Acceptance Scenarios**:

1. **Given** um arquivo CSV com encoding ISO-8859-1 ou Windows-1252, **When**
   o parse ocorre, **Then** nomes com acentos (ã, ç, é, ô) são exibidos
   corretamente no preview, sem intervenção do Admin.

2. **Given** um CSV UTF-8 (encoding padrão), **When** o parse ocorre, **Then**
   todos os caracteres são exibidos corretamente (comportamento preservado).

---

### Edge Cases

- O que acontece quando o arquivo CSV tem cabeçalho ausente ou com colunas
  em ordem diferente do template? → Sistema identifica colunas por nome (não
  posição) e alerta quais colunas obrigatórias estão faltando.
- O que acontece com um arquivo CSV completamente vazio (0 linhas de dados)?
  → Sistema exibe mensagem "Arquivo sem participantes — nenhuma linha de dados
  encontrada".
- O que acontece quando o batch de check-emails excede 500 e-mails? → O
  sistema divide em batches automaticamente no cliente; o Admin não percebe.
- O que acontece quando o servidor está indisponível ao checar e-mails? →
  O preview exibe sem o status de "já cadastrado" (degradação graciosa), com
  aviso discreto de que a verificação de duplicatas não foi possível.
- O que acontece com linhas que têm células extras ou faltando? → Células
  opcionais ausentes são tratadas como vazias; células extras além das colunas
  conhecidas são ignoradas silenciosamente.
- O que acontece com um arquivo XLSX com múltiplas abas? → Apenas a primeira
  aba é processada; o Admin é informado com aviso.

---

## Requirements

### Functional Requirements

**Upload e seleção de arquivo**

- **FR-01**: O sistema DEVE aceitar arquivos `.csv` e `.xlsx` por drag & drop
  e por clique no seletor de arquivo nativo.
- **FR-02**: O sistema DEVE rejeitar arquivos maiores que 5 MB com mensagem
  de erro user-friendly em PT-BR antes de qualquer processamento.
- **FR-03**: O sistema DEVE rejeitar arquivos com extensão diferente de `.csv`
  e `.xlsx` com mensagem indicando os formatos aceitos.
- **FR-04**: O sistema DEVE oferecer botão "Baixar template" que gera e baixa
  um arquivo CSV modelo com as colunas corretas sem requisição de rede.

**Parse e encoding**

- **FR-05**: O sistema DEVE detectar automaticamente o encoding do CSV entre
  UTF-8, ISO-8859-1 e Windows-1252, sem intervenção do usuário.
- **FR-06**: O sistema DEVE processar arquivos XLSX sem carregar a biblioteca
  de parse XLSX no bundle inicial (carregamento sob demanda somente quando
  necessário).
- **FR-07**: Para arquivos XLSX com múltiplas abas, o sistema DEVE processar
  apenas a primeira aba e informar ao Admin com aviso não-bloqueante.

**Estrutura das colunas**

- **FR-08**: O sistema DEVE identificar colunas por nome (não por posição),
  suportando variações de capitalização.
- **FR-09**: As colunas reconhecidas são: `nome` (obrigatória), `email`
  (obrigatória), `telefone` (opcional), `papel` (opcional — valores:
  `participante` ou `lider`, default `participante`).
- **FR-10**: O sistema DEVE alertar com erro crítico quando colunas
  obrigatórias (`nome`, `email`) estiverem ausentes no arquivo.

**Validação inline**

- **FR-11**: O sistema DEVE classificar cada linha em três estados: `crítico`
  (impede importação da linha), `aviso` (importação possível com ressalva) ou
  `ok`.
- **FR-12**: Condições de estado `crítico`: e-mail ausente, e-mail em formato
  inválido, nome com menos de 2 caracteres.
- **FR-13**: Condições de estado `aviso`: e-mail já cadastrado no tenant
  (verificado via API), papel com valor não reconhecido (usa default).
- **FR-14**: O sistema DEVE exibir para cada linha crítica uma mensagem
  descritiva do problema em PT-BR.
- **FR-15**: O botão de avançar para confirmação DEVE permanecer desabilitado
  enquanto houver ao menos uma linha com estado `crítico`.

**Preview**

- **FR-16**: O sistema DEVE exibir tabela de preview com as primeiras 10 linhas
  do arquivo e um resumo com totais (total de linhas, críticas, avisos, válidas).
- **FR-17**: O resumo DEVE ser atualizado após a verificação de e-mails retornar
  do servidor.

**Verificação de e-mails no tenant**

- **FR-18**: O sistema DEVE verificar se os e-mails do arquivo já estão
  cadastrados no tenant atual via chamada à API (`GET /api/v1/users/check-emails`).
- **FR-19**: A verificação DEVE ser escopo-tenant (somente participantes do
  tenant atual — sem verificação cross-tenant).
- **FR-20**: A API DEVE aceitar até 500 e-mails por requisição; o cliente DEVE
  dividir automaticamente em batches quando o total exceder esse limite.
- **FR-21**: Se a API de verificação estiver indisponível, o sistema DEVE
  degradar graciosamente: exibir o preview sem indicador de duplicatas e
  mostrar aviso discreto ao Admin.

**Acessibilidade**

- **FR-22**: A zona de upload DEVE ser operável por teclado (foco, Enter/Space
  para abrir seletor) e ter labels ARIA adequados.
- **FR-23**: A tabela de preview DEVE ter cabeçalhos de coluna acessíveis e
  os indicadores de status DEVE ter alternativa textual (não apenas ícone/cor).

**Vocabulário pastoral**

- **FR-24**: Toda a interface DEVE usar vocabulário pastoral em PT-BR:
  "Importar participantes", "Arquivo de importação", "Pré-visualização",
  "Participante", "Líder" — nunca termos corporativos como "usuário", "upload
  de dados" ou "bulk import".

### Key Entities

- **Arquivo de Importação**: unidade de trabalho temporária, client-side
  apenas — nunca persiste no servidor nesta feature. Contém o conteúdo bruto
  do CSV/XLSX selecionado.
- **Linha de Importação**: representação de um participante a ser importado.
  Atributos: nome (obrigatório), e-mail (obrigatório), telefone (opcional),
  papel no grupo (opcional). Estado de validação: crítico / aviso / ok.
- **Template de Importação**: arquivo CSV modelo gerado dinamicamente pelo
  cliente, com as colunas `nome`, `email`, `telefone`, `papel`.

> **Decisões de infraestrutura**: N/A — feature stateless no servidor
> (endpoint check-emails é leitura pura, sem estado, sem filas, sem migration).
> Parse e validação ocorrem inteiramente no cliente.

---

## Clarifications

> Decisões já fixadas pela RECONCILIACAO-EPIC10.md §10 — não reabrir:
>
> - `check-emails` reporta existência APENAS no tenant corrente (RLS-scoped,
>   não cross-tenant). Desambiguação cross-tenant fica para a 10-4.
> - Batch máximo: 500 e-mails por request.
> - XLSX via carregamento sob demanda (dynamic import). CSV pode usar parser
>   leve próprio ou papaparse — decisão de implementação para o `/plan`.
> - Sem migration nesta story.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Admin consegue selecionar um arquivo CSV ou XLSX e ver o preview
  validado em menos de 3 segundos para arquivos de até 200 linhas.
- **SC-002**: 100% dos arquivos CSV com encoding ISO-8859-1 ou Windows-1252
  gerados pelo Excel BR têm acentos exibidos corretamente no preview.
- **SC-003**: Admin consegue identificar visualmente todas as linhas com
  problema crítico sem precisar percorrer o arquivo fora do sistema.
- **SC-004**: A biblioteca de parse XLSX não é incluída no bundle JavaScript
  inicial — só carregada quando o Admin selecionar um arquivo `.xlsx`.
- **SC-005**: A zona de upload e a tabela de preview passam em auditoria de
  acessibilidade WCAG 2.1 AA (sem violações críticas).
- **SC-006**: O endpoint `GET /api/v1/users/check-emails` retorna resultado
  para batch de 500 e-mails em menos de 2 segundos em condições normais de
  carga.
- **SC-007**: Nenhum dado do arquivo de importação é enviado ao servidor
  nesta etapa — apenas os e-mails são transmitidos para verificação de
  duplicatas.
