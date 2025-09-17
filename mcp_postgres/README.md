# MCP PostgreSQL Server

Servidor MCP (Model Context Protocol) para integração com PostgreSQL, permitindo que IAs executem consultas seguras em bancos de dados PostgreSQL através de ferramentas estruturadas.

## Funcionalidades

- **Consultas SELECT seguras** - Execute apenas consultas de leitura e CTEs (WITH)
- **Descrição de tabelas** - Obtenha estrutura detalhada das tabelas com constraints
- **Análise de queries** - Explique planos de execução com EXPLAIN e EXPLAIN ANALYZE
- **Listagem de tabelas** - Visualize todas as tabelas do banco por schema
- **Listagem de schemas** - Visualize todos os schemas disponíveis
- **Suporte a SSL** - Conecte a bancos PostgreSQL com SSL
- **Proteções de segurança** - Limite de resultados e validação de queries

## Instalação

```bash
npm install
```

## Configuração

### Variáveis de Ambiente Obrigatórias

```bash
POSTGRES_HOST=localhost
POSTGRES_USER=seu_usuario
POSTGRES_DATABASE=sua_base_dados
```

### Variáveis de Ambiente Opcionais

```bash
POSTGRES_PORT=5432                # Padrão: 5432
POSTGRES_PASSWORD=sua_senha       # Padrão: string vazia
POSTGRES_SSL=true                 # Padrão: false (usar SSL)
```

## Configuração no Cursor IDE (por workspace)

Crie o arquivo `.cursor/settings.json` na raiz do seu workspace com o conteúdo abaixo. Essa configuração fica versionada no projeto, vale apenas para esse workspace e não interfere em outros.

```json
{
  "modelcontextprotocol": {
    "servers": {
      "postgres": {
        "command": "node",
        "args": ["./mcp_postgres/server.js"],
        "env": {
          "POSTGRES_HOST": "localhost",
          "POSTGRES_PORT": "5432",
          "POSTGRES_USER": "seu_usuario",
          "POSTGRES_PASSWORD": "sua_senha",
          "POSTGRES_DATABASE": "sua_base_dados",
          "POSTGRES_SSL": "false"
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
- Fácil trocar de ambiente: crie entradas como `postgres-dev`, `postgres-hml` e `postgres-prod` no mesmo arquivo.
- Sem tocar no sistema: dispensa editar arquivos globais do Cursor.

## Ferramentas Disponíveis

### 1. execute_select_query
Executa queries SELECT e CTEs (WITH) com segurança.

**Parâmetros:**
- `query` (string): Query SELECT ou WITH para executar
- `limit` (number, opcional): Limite de resultados (máximo 1000, padrão 100)

**Exemplos:**
```sql
SELECT * FROM usuarios WHERE ativo = true;
```

```sql
WITH vendas_mensais AS (
  SELECT DATE_TRUNC('month', data_venda) as mes, SUM(valor) as total
  FROM vendas
  WHERE data_venda >= '2024-01-01'
  GROUP BY DATE_TRUNC('month', data_venda)
)
SELECT * FROM vendas_mensais ORDER BY mes;
```

### 2. describe_table
Mostra a estrutura detalhada de uma tabela incluindo constraints.

**Parâmetros:**
- `tableName` (string): Nome da tabela
- `schemaName` (string, opcional): Nome do schema (padrão: public)

**Exemplo:**
```
tableName: usuarios
schemaName: public
```

### 3. explain_query
Analisa o plano de execução de uma query.

**Parâmetros:**
- `query` (string): Query para analisar
- `analyze` (boolean, opcional): Usar EXPLAIN ANALYZE para análise mais detalhada (padrão: false)

**Exemplos:**
```sql
SELECT * FROM pedidos p JOIN usuarios u ON p.usuario_id = u.id WHERE u.cidade = 'São Paulo';
```

### 4. list_tables
Lista todas as tabelas do banco de dados.

**Parâmetros:**
- `schemaName` (string, opcional): Nome do schema para filtrar

**Exemplo:**
```
schemaName: public
```

### 5. list_schemas
Lista todos os schemas do banco de dados.

**Sem parâmetros**

## Exemplos de Uso no Cursor

Após configurar o servidor, você pode usar comandos como:

```
"Liste todos os schemas do banco"
"Liste todas as tabelas do schema public"
"Mostre a estrutura da tabela usuarios"
"Execute: SELECT COUNT(*) FROM pedidos WHERE created_at >= '2024-01-01'"
"Explique esta query: SELECT * FROM produtos WHERE preco > 100"
"Analyze query: SELECT p.*, u.nome FROM pedidos p JOIN usuarios u ON p.usuario_id = u.id"
```

## Recursos Específicos do PostgreSQL

### Suporte a CTEs (Common Table Expressions)
```sql
WITH RECURSIVE categorias_hierarquia AS (
  SELECT id, nome, parent_id, 1 as nivel
  FROM categorias WHERE parent_id IS NULL
  UNION ALL
  SELECT c.id, c.nome, c.parent_id, ch.nivel + 1
  FROM categorias c
  JOIN categorias_hierarquia ch ON c.parent_id = ch.id
)
SELECT * FROM categorias_hierarquia ORDER BY nivel, nome;
```

### Funções de Janela (Window Functions)
```sql
SELECT
  nome,
  salario,
  RANK() OVER (ORDER BY salario DESC) as ranking,
  AVG(salario) OVER () as media_geral
FROM funcionarios;
```

### Arrays e JSONB
```sql
SELECT
  id,
  tags,
  metadata->>'tipo' as tipo,
  jsonb_array_length(dados->'itens') as qtd_itens
FROM produtos
WHERE 'eletrônico' = ANY(tags);
```

## Segurança

- **Somente SELECTs e CTEs**: Apenas consultas de leitura são permitidas
- **Limite de resultados**: Máximo de 1000 registros por consulta
- **Validação de queries**: Verificação automática de comandos perigosos
- **Suporte a SSL**: Conexões criptografadas para ambientes de produção
- **Schemas isolados**: Acesso controlado por schema quando necessário

## Solução de Problemas

### Erro de Conexão
```
❌ Erro ao conectar ao PostgreSQL: connect ECONNREFUSED
```
**Solução:** Verifique se o PostgreSQL está rodando e as credenciais estão corretas.

### Variáveis de Ambiente Faltando
```
❌ Variáveis de ambiente faltando: POSTGRES_HOST, POSTGRES_USER
```
**Solução:** Configure todas as variáveis obrigatórias.

### Erro de SSL
```
❌ SSL connection required
```
**Solução:** Configure `POSTGRES_SSL=true` ou ajuste as configurações SSL do servidor.

### Permissões Insuficientes
```
❌ permission denied for table
```
**Solução:** Verifique as permissões do usuário PostgreSQL no schema/tabela.

### Schema não encontrado
```
❌ schema "nome_schema" does not exist
```
**Solução:** Verifique se o schema existe usando a ferramenta `list_schemas`.

## Diferenças do MySQL

- **Schemas**: PostgreSQL usa schemas para organizar tabelas (padrão: public)
- **Tipos de dados**: Suporte a arrays, JSONB, UUID, etc.
- **CTEs recursivas**: Suporte nativo a consultas recursivas
- **Case-sensitive**: Nomes não-quoted são convertidos para minúsculas
- **Funções de janela**: Suporte avançado a window functions
- **EXPLAIN ANALYZE**: Análise de performance mais detalhada

## Requisitos

- Node.js >= 14
- PostgreSQL >= 12
- Cursor IDE com suporte a MCP

## Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## Licença

ISC License