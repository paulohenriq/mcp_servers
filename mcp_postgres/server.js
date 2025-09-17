#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  ListToolsRequestSchema,
  CallToolRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');
const { Client } = require('pg');

class PostgreSQLMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'postgresql-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.client = null;
    this.setupHandlers();
  }

  async connect() {
    try {
      // Validar ENVs obrigatórias
      const requiredEnvs = ['POSTGRES_HOST', 'POSTGRES_USER', 'POSTGRES_DATABASE'];
      const missing = requiredEnvs.filter(env => !process.env[env]);

      if (missing.length > 0) {
        throw new Error(`Variáveis de ambiente faltando: ${missing.join(', ')}`);
      }

      this.client = new Client({
        host: process.env.POSTGRES_HOST,
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD || '',
        database: process.env.POSTGRES_DATABASE,
        ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
      });

      await this.client.connect();
      console.error(`✅ Conectado ao PostgreSQL: ${process.env.POSTGRES_DATABASE}@${process.env.POSTGRES_HOST}`);
    } catch (error) {
      console.error('❌ Erro ao conectar ao PostgreSQL:', error.message);
      console.error('📋 ENVs disponíveis:', {
        POSTGRES_HOST: process.env.POSTGRES_HOST,
        POSTGRES_PORT: process.env.POSTGRES_PORT,
        POSTGRES_USER: process.env.POSTGRES_USER,
        POSTGRES_DATABASE: process.env.POSTGRES_DATABASE,
        POSTGRES_SSL: process.env.POSTGRES_SSL,
        // Não logar a senha por segurança
        POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD ? '***' : 'não definida'
      });
      throw error;
    }
  }

  setupHandlers() {
    // Listar ferramentas disponíveis
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'execute_select_query',
            title: 'Executar Query SELECT',
            description: 'Executa uma query SELECT (somente leitura)',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Query SELECT para executar',
                },
                limit: {
                  type: 'number',
                  description: 'Limite de resultados (máximo 1000)',
                  default: 100,
                  maximum: 1000
                }
              },
              required: ['query'],
            },
          },
          {
            name: 'describe_table',
            title: 'Descrever Tabela',
            description: 'Mostra informações detalhadas sobre uma tabela',
            inputSchema: {
              type: 'object',
              properties: {
                tableName: {
                  type: 'string',
                  description: 'Nome da tabela',
                },
                schemaName: {
                  type: 'string',
                  description: 'Nome do schema (padrão: public)',
                  default: 'public'
                }
              },
              required: ['tableName'],
            },
          },
          {
            name: 'explain_query',
            title: 'Explicar Query',
            description: 'Explica o plano de execução de uma query',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Query para analisar',
                },
                analyze: {
                  type: 'boolean',
                  description: 'Executar EXPLAIN ANALYZE (mais detalhado)',
                  default: false
                }
              },
              required: ['query'],
            },
          },
          {
            name: 'list_tables',
            title: 'Listar Tabelas',
            description: 'Lista todas as tabelas do banco de dados',
            inputSchema: {
              type: 'object',
              properties: {
                schemaName: {
                  type: 'string',
                  description: 'Nome do schema para filtrar (opcional)',
                }
              },
            },
          },
          {
            name: 'list_schemas',
            title: 'Listar Schemas',
            description: 'Lista todos os schemas do banco de dados',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          }
        ],
      };
    });

    // Executar ferramentas
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!this.client) await this.connect();

      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'execute_select_query':
            // Validar que é SELECT
            const query = args.query.trim();
            if (!query.toLowerCase().startsWith('select') &&
                !query.toLowerCase().startsWith('with')) {
              throw new Error('Apenas queries SELECT e CTE (WITH) são permitidas');
            }

            const limit = Math.min(args.limit || 100, 1000);
            const finalQuery = query.toLowerCase().includes('limit')
              ? query
              : `${query} LIMIT ${limit}`;

            const result = await this.client.query(finalQuery);

            return {
              content: [{
                type: 'text',
                text: `✅ Query executada com sucesso!\n\n📊 **Resultados (${result.rows.length} linhas):**\n\n\`\`\`json\n${JSON.stringify(result.rows, null, 2)}\n\`\`\``,
              }],
            };

          case 'describe_table':
            const schema = args.schemaName || 'public';
            const descResult = await this.client.query(`
              SELECT
                column_name AS "Campo",
                data_type AS "Tipo",
                is_nullable AS "Nulo",
                column_default AS "Padrão",
                character_maximum_length AS "Tamanho",
                numeric_precision AS "Precisão",
                numeric_scale AS "Escala"
              FROM information_schema.columns
              WHERE table_schema = $1 AND table_name = $2
              ORDER BY ordinal_position
            `, [schema, args.tableName]);

            // Buscar constraints (chaves primárias, estrangeiras, etc.)
            const constraintsResult = await this.client.query(`
              SELECT
                tc.constraint_name AS "Nome_Constraint",
                tc.constraint_type AS "Tipo",
                kcu.column_name AS "Coluna"
              FROM information_schema.table_constraints tc
              JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
              WHERE tc.table_schema = $1 AND tc.table_name = $2
              ORDER BY tc.constraint_type, kcu.ordinal_position
            `, [schema, args.tableName]);

            return {
              content: [{
                type: 'text',
                text: `📋 **Estrutura da tabela \`${schema}.${args.tableName}\`:**\n\n**Colunas:**\n\`\`\`json\n${JSON.stringify(descResult.rows, null, 2)}\n\`\`\`\n\n**Constraints:**\n\`\`\`json\n${JSON.stringify(constraintsResult.rows, null, 2)}\n\`\`\``,
              }],
            };

          case 'explain_query':
            const explainCmd = args.analyze ? 'EXPLAIN ANALYZE' : 'EXPLAIN';
            const explainResult = await this.client.query(`${explainCmd} ${args.query}`);

            return {
              content: [{
                type: 'text',
                text: `🔍 **Plano de execução ${args.analyze ? '(com análise)' : ''}:**\n\n\`\`\`\n${explainResult.rows.map(row => row['QUERY PLAN']).join('\n')}\n\`\`\``,
              }],
            };

          case 'list_tables':
            let tablesQuery = `
              SELECT
                schemaname AS "Schema",
                tablename AS "Tabela",
                tableowner AS "Proprietário"
              FROM pg_tables
            `;

            const queryParams = [];
            if (args.schemaName) {
              tablesQuery += ` WHERE schemaname = $1`;
              queryParams.push(args.schemaName);
            } else {
              tablesQuery += ` WHERE schemaname NOT IN ('information_schema', 'pg_catalog')`;
            }

            tablesQuery += ` ORDER BY schemaname, tablename`;

            const tablesResult = await this.client.query(tablesQuery, queryParams);

            return {
              content: [{
                type: 'text',
                text: `📋 **Tabelas do banco \`${process.env.POSTGRES_DATABASE}\`:**\n\n\`\`\`json\n${JSON.stringify(tablesResult.rows, null, 2)}\n\`\`\``,
              }],
            };

          case 'list_schemas':
            const schemasResult = await this.client.query(`
              SELECT
                schema_name AS "Schema",
                schema_owner AS "Proprietário"
              FROM information_schema.schemata
              WHERE schema_name NOT IN ('information_schema', 'pg_catalog')
              ORDER BY schema_name
            `);

            return {
              content: [{
                type: 'text',
                text: `📋 **Schemas do banco \`${process.env.POSTGRES_DATABASE}\`:**\n\n\`\`\`json\n${JSON.stringify(schemasResult.rows, null, 2)}\n\`\`\``,
              }],
            };

          default:
            throw new Error(`Ferramenta desconhecida: ${name}`);
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ **Erro:** ${error.message}`,
          }],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('🚀 Servidor MCP PostgreSQL iniciado');
  }
}

// Iniciar servidor
const server = new PostgreSQLMCPServer();
server.run().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

// Cleanup
process.on('SIGINT', async () => {
  console.error('🔌 Desconectando...');
  if (server.client) {
    await server.client.end();
  }
  process.exit(0);
});