# MCP MySQL Server

Servidor MCP (Model Context Protocol) para integração com MySQL, permitindo que IAs executem consultas seguras em bancos de dados MySQL através de ferramentas estruturadas.

## Funcionalidades

- **Consultas SELECT seguras** - Execute apenas consultas de leitura
- **Descrição de tabelas** - Obtenha estrutura detalhada das tabelas
- **Análise de queries** - Explique planos de execução
- **Listagem de tabelas** - Visualize todas as tabelas do banco
- **Proteções de segurança** - Limite de resultados e validação de queries

## Instalar as dependências

```bash
npm install
```

## Disponibilizar globalmente para uso nos workspaces dos projetos

```bash
npm link
```

## Configuração

### Variáveis de Ambiente Obrigatórias

```bash
MYSQL_HOST=localhost
MYSQL_USER=seu_usuario
MYSQL_DATABASE=sua_base_dados
```

### Variáveis de Ambiente Opcionais

```bash
MYSQL_PORT=3306              # Padrão: 3306
MYSQL_PASSWORD=sua_senha     # Padrão: string vazia
```

## Configuração no Cursor IDE (por workspace)

Crie o arquivo `.cursor/settings.json` na raiz do seu workspace com o conteúdo abaixo. Essa configuração fica versionada no projeto, vale apenas para esse workspace e não interfere em outros.

```json
{
  "modelcontextprotocol": {
    "servers": {
      "mysql": {
        "command": "node",
        "args": ["./mcp_mysql/server.js"],
        "env": {
          "MYSQL_HOST": "localhost",
          "MYSQL_PORT": "3306",
          "MYSQL_USER": "seu_usuario",
          "MYSQL_PASSWORD": "sua_senha",
          "MYSQL_DATABASE": "sua_base_dados"
        }
      }
    }
  }
}
```

Por que usar `.cursor/settings.json`?

- Mais flexível: a configuração vive junto do projeto e pode variar por workspace.
- Versionável: pode ser commitada e compartilhada com a equipe via Git.
- Isolado por projeto: não afeta outras pastas ou instalações do Cursor.
- Fácil trocar de ambiente: crie entradas como `mysql-dev`, `mysql-hml` e `mysql-prod` no mesmo arquivo.
- Sem tocar no sistema: dispensa editar arquivos globais do Cursor.

## Ferramentas Disponíveis

### 1. execute_select_query
Executa queries SELECT com segurança.

**Parâmetros:**
- `query` (string): Query SELECT para executar
- `limit` (number, opcional): Limite de resultados (máximo 1000, padrão 100)

**Exemplo:**
```sql
SELECT * FROM usuarios WHERE ativo = 1
```

### 2. describe_table
Mostra a estrutura detalhada de uma tabela.

**Parâmetros:**
- `tableName` (string): Nome da tabela

**Exemplo:**
```
usuarios
```

### 3. explain_query
Analisa o plano de execução de uma query.

**Parâmetros:**
- `query` (string): Query para analisar

**Exemplo:**
```sql
SELECT * FROM pedidos p JOIN usuarios u ON p.usuario_id = u.id WHERE u.cidade = 'São Paulo'
```

### 4. list_tables
Lista todas as tabelas do banco de dados.

**Sem parâmetros**

## Exemplos de Uso no Cursor

Após configurar o servidor, você pode usar comandos como:

```
"Liste todas as tabelas do banco"
"Mostre a estrutura da tabela usuarios"
"Execute: SELECT COUNT(*) FROM pedidos WHERE data_pedido >= '2024-01-01'"
"Explique esta query: SELECT * FROM produtos WHERE preco > 100"
```

## Segurança

- **Somente SELECTs**: Apenas consultas de leitura são permitidas
- **Limite de resultados**: Máximo de 1000 registros por consulta
- **Validação de queries**: Verificação automática de comandos perigosos
- **Conexão segura**: Sem multiple statements habilitados

## Solução de Problemas

### Erro de Conexão
```
L Erro ao conectar ao MySQL: connect ECONNREFUSED
```
**Solução:** Verifique se o MySQL está rodando e as credenciais estão corretas.

### Variáveis de Ambiente Faltando
```
L Variáveis de ambiente faltando: MYSQL_HOST, MYSQL_USER
```
**Solução:** Configure todas as variáveis obrigatórias.

### Permissões Insuficientes
```
L Access denied for user
```
**Solução:** Verifique as permissões do usuário MySQL.

## Requisitos

- Node.js >= 14
- MySQL >= 5.7 ou MariaDB >= 10.2
- Cursor IDE com suporte a MCP

## Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## Licença

ISC License


