#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  ListToolsRequestSchema,
  CallToolRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');
const mysql = require('mysql2/promise');

class MySQLMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'mysql-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.connection = null;
    this.setupHandlers();
  }

  async connect() {
    try {
      // Validar ENVs obrigatórias
      const requiredEnvs = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE'];
      const missing = requiredEnvs.filter(env => !process.env[env]);

      if (missing.length > 0) {
        throw new Error(`Variáveis de ambiente faltando: ${missing.join(', ')}`);
      }

      this.connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        port: parseInt(process.env.MYSQL_PORT || '3306'),
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE,
        multipleStatements: false // Segurança
      });

      // Testar conexão
      await this.connection.ping();
      console.error(`✅ Conectado ao MySQL: ${process.env.MYSQL_DATABASE}@${process.env.MYSQL_HOST}`);
    } catch (error) {
      console.error('❌ Erro ao conectar ao MySQL:', error.message);
      console.error('📋 ENVs disponíveis:', {
        MYSQL_HOST: process.env.MYSQL_HOST,
        MYSQL_PORT: process.env.MYSQL_PORT,
        MYSQL_USER: process.env.MYSQL_USER,
        MYSQL_DATABASE: process.env.MYSQL_DATABASE,
        // Não logar a senha por segurança
        MYSQL_PASSWORD: process.env.MYSQL_PASSWORD ? '***' : 'não definida'
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
              properties: {},
            },
          }
        ],
      };
    });

    // Executar ferramentas
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!this.connection) await this.connect();

      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'execute_select_query':
            // Validar que é SELECT
            const query = args.query.trim();
            if (!query.toLowerCase().startsWith('select')) {
              throw new Error('Apenas queries SELECT são permitidas');
            }

            const limit = Math.min(args.limit || 100, 1000);
            const finalQuery = query.toLowerCase().includes('limit')
              ? query
              : `${query} LIMIT ${limit}`;

            const [results] = await this.connection.execute(finalQuery);

            return {
              content: [{
                type: 'text',
                text: `✅ Query executada com sucesso!\n\n📊 **Resultados (${results.length} linhas):**\n\n\`\`\`json\n${JSON.stringify(results, null, 2)}\n\`\`\``,
              }],
            };

          case 'describe_table':
            const [desc] = await this.connection.execute(`
              SELECT
                COLUMN_NAME as Campo,
                COLUMN_TYPE as Tipo,
                IS_NULLABLE as Nulo,
                COLUMN_KEY as Chave,
                COLUMN_DEFAULT as Padrão,
                EXTRA as Extra
              FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
              ORDER BY ORDINAL_POSITION
            `, [process.env.MYSQL_DATABASE, args.tableName]);

            return {
              content: [{
                type: 'text',
                text: `📋 **Estrutura da tabela \`${args.tableName}\`:**\n\n\`\`\`json\n${JSON.stringify(desc, null, 2)}\n\`\`\``,
              }],
            };

          case 'explain_query':
            const [explain] = await this.connection.execute(`EXPLAIN ${args.query}`);

            return {
              content: [{
                type: 'text',
                text: `🔍 **Plano de execução:**\n\n\`\`\`json\n${JSON.stringify(explain, null, 2)}\n\`\`\``,
              }],
            };

          case 'list_tables':
            const [tables] = await this.connection.execute(`
              SELECT TABLE_NAME, TABLE_COMMENT, TABLE_ROWS
              FROM information_schema.TABLES
              WHERE TABLE_SCHEMA = ?
              ORDER BY TABLE_NAME
            `, [process.env.MYSQL_DATABASE]);

            return {
              content: [{
                type: 'text',
                text: `📋 **Tabelas do banco \`${process.env.MYSQL_DATABASE}\`:**\n\n\`\`\`json\n${JSON.stringify(tables, null, 2)}\n\`\`\``,
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
    console.error('🚀 Servidor MCP MySQL iniciado');
  }
}

// Iniciar servidor
const server = new MySQLMCPServer();
server.run().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

// Cleanup
process.on('SIGINT', async () => {
  console.error('🔌 Desconectando...');
  if (server.connection) {
    await server.connection.end();
  }
  process.exit(0);
});