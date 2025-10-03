# MCP Jira Server

Servidor MCP (Model Context Protocol) para integração com Jira Cloud, permitindo buscar issues, adicionar worklogs e obter informações detalhadas de tarefas.

## 🚀 Funcionalidades

- **Buscar Issues**: Obter dados detalhados de issues específicas
- **Adicionar Worklogs**: Registrar tempo trabalhado em issues
- **Buscar via JQL**: Pesquisar issues usando JQL (Java Query Language)

## 📋 Pré-requisitos

- Node.js 18+ 
- Conta no Jira Cloud
- Token de API do Jira

## 🔧 Instalação

1. **Clone o repositório** (se ainda não tiver):
```bash
git clone <seu-repositorio>
cd mcp_servers/mcp_jira
```

2. **Instale as dependências**:
```bash
npm install
```

3. **Configure as variáveis de ambiente**:
```bash
export JIRA_BASE_URL="https://seu-dominio.atlassian.net"
export JIRA_EMAIL="seu-email@exemplo.com"
export JIRA_API_TOKEN="seu-token-aqui"
export JIRA_USER_TZ="America/Sao_Paulo"  # Opcional, padrão: UTC
```

4. **Instale globalmente**:
```bash
npm link
```

## 🔑 Configuração das Variáveis de Ambiente

### Obrigatórias:
- `JIRA_BASE_URL`: URL base do seu Jira (ex: `https://softohq.atlassian.net`)
- `JIRA_EMAIL`: Seu email do Jira
- `JIRA_API_TOKEN`: Token de API do Jira

### Opcionais:
- `JIRA_USER_TZ`: Timezone do usuário (padrão: UTC)

### Como obter o Token de API:
1. Acesse [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Clique em "Create API token"
3. Dê um nome para o token
4. Copie o token gerado

## 🎯 Configuração no Cursor

Adicione ao seu `mcp.json` do Cursor:

```json
{
  "mcpServers": {
    "jira": {
      "command": "jira-mcp-server",
      "args": [],
      "env": {
        "JIRA_BASE_URL": "https://seu-dominio.atlassian.net",
        "JIRA_EMAIL": "seu-email@exemplo.com",
        "JIRA_API_TOKEN": "seu-token-aqui",
        "JIRA_USER_TZ": "America/Sao_Paulo"
      },
      "autoStart": true
    }
  }
}
```

## 🛠️ Ferramentas Disponíveis

### 1. **jira.getIssue**
Obtém dados detalhados de uma issue específica.

**Parâmetros:**
- `issueKey` (obrigatório): Chave da issue (ex: "PROJ-123")
- `fields` (opcional): Array de campos específicos para retornar

**Exemplo:**
```javascript
// Buscar issue com todos os campos
jira.getIssue({ issueKey: "WECLEVERAN-254" })

// Buscar campos específicos
jira.getIssue({ 
  issueKey: "WECLEVERAN-254", 
  fields: ["summary", "status", "worklog"] 
})
```

### 2. **jira.addWorklog**
Adiciona um worklog (registro de tempo) em uma issue.

**Parâmetros:**
- `issueKey` (obrigatório): Chave da issue
- `timeSpentSeconds` (obrigatório): Tempo em segundos (ex: 28800 = 8h)
- `started` (opcional): Data/hora de início (ISO format)
- `comment` (opcional): Comentário do worklog
- `visibility` (opcional): Visibilidade do worklog

**Exemplo:**
```javascript
jira.addWorklog({
  issueKey: "WECLEVERAN-254",
  timeSpentSeconds: 28800, // 8 horas
  started: "2025-10-01T09:00:00-03:00",
  comment: "Desenvolvimento da funcionalidade X"
})
```

### 3. **jira.searchJql**
Busca issues usando JQL (Java Query Language).

**Parâmetros:**
- `jql` (obrigatório): Query JQL
- `maxResults` (opcional): Máximo de resultados (padrão: 25)
- `fields` (opcional): Array de campos para retornar

**Exemplo:**
```javascript
jira.searchJql({
  jql: "assignee = currentUser() AND status = 'In Progress'",
  maxResults: 10,
  fields: ["summary", "status", "worklog"]
})
```

## 📝 Exemplos de Uso

### Buscar minhas issues em progresso:
```javascript
jira.searchJql({
  jql: "assignee = currentUser() AND status = 'In Progress'",
  maxResults: 5
})
```

### Registrar 8 horas de trabalho:
```javascript
jira.addWorklog({
  issueKey: "PROJ-123",
  timeSpentSeconds: 28800, // 8 horas
  started: "2025-10-01T09:00:00-03:00",
  comment: "Desenvolvimento da feature X"
})
```

### Obter detalhes de uma issue:
```javascript
jira.getIssue({
  issueKey: "PROJ-123",
  fields: ["summary", "status", "worklog", "assignee"]
})
```

## 🔍 JQL (Java Query Language)

O JQL permite fazer buscas avançadas no Jira:

```javascript
// Minhas issues
"assignee = currentUser()"

// Issues por projeto
"project = PROJ"

// Issues por status
"status = 'In Progress'"

// Issues com worklogs
"worklogAuthor = currentUser()"

// Issues atualizadas esta semana
"updated >= startOfWeek()"

// Combinações
"assignee = currentUser() AND status = 'In Progress' AND updated >= startOfWeek()"
```

## 🚨 Troubleshooting

### Erro de Autenticação:
- Verifique se o `JIRA_EMAIL` e `JIRA_API_TOKEN` estão corretos
- Confirme se o token tem as permissões necessárias

### Erro 410 "API has been removed":
- O endpoint de busca JQL pode estar com problemas
- Use `jira.getIssue` para buscar issues específicas

### Timezone Issues:
- Configure `JIRA_USER_TZ` corretamente
- Use formato ISO com timezone: `2025-10-01T09:00:00-03:00`

## 📚 Recursos Adicionais

- [Documentação Jira REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [JQL Reference](https://www.atlassian.com/software/jira/guides/expand-jira/jql)
- [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença ISC.
