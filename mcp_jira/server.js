#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";

// ---------- Helpers ----------
function basicAuthHeader(email, token) {
  const b64 = Buffer.from(`${email}:${token}`).toString("base64");
  return `Basic ${b64}`;
}

// Jira aceita "started" como "YYYY-MM-DDTHH:mm:ss.SSSZ" (ex.: +0000).
// Vamos gerar no fuso do usuário se vier só date/hora local.
function toJiraStartedISO(input, tz = "UTC") {
  // Se já vier um ISO com offset tipo "+0000" ou "+03:00", apenas retorna
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?([+-]\d{2}:?\d{2}|Z|[+-]\d{4})$/.test(input)) {
    // Normaliza "+03:00" para "+0300"
    return input.replace(/([+-]\d{2}):(\d{2})$/, (_m, h, m) => `${h}${m}`);
  }
  // Caso contrário, interpreta como local e aplica timezone
  const dt = new Date(input);
  if (isNaN(dt)) throw new Error(`started inválido: ${input}`);

  // Formata como "+HHMM"
  const offsetMin = -dt.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const pad = (n) => String(Math.abs(n)).padStart(2, "0");
  const hh = pad(Math.trunc(Math.abs(offsetMin) / 60));
  const mm = pad(Math.abs(offsetMin) % 60);
  const off = `${sign}${hh}${mm}`;

  const yyyy = dt.getFullYear();
  const MM = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  const HH = String(dt.getHours()).padStart(2, "0");
  const min = String(dt.getMinutes()).padStart(2, "0");
  const ss = String(dt.getSeconds()).padStart(2, "0");
  const ms = String(dt.getMilliseconds()).padStart(3, "0");

  return `${yyyy}-${MM}-${dd}T${HH}:${min}:${ss}.${ms}${off}`;
}

async function jiraFetch(method, path, body) {
  const base = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!base || !email || !token) {
    throw new Error("Env ausente: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN.");
  }

  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Authorization": basicAuthHeader(email, token),
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }

  if (!res.ok) {
    const msg = json?.errorMessages?.join(" | ") || json?.errors || text || res.statusText;
    throw new Error(`Jira API ${res.status} ${res.statusText}: ${msg}`);
  }
  return json ?? {};
}

// ---------- MCP Server ----------
class JiraMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "jira-worklog-mcp",
        version: "1.0.0",
        description: "MCP Server para pesquisar issues e lançar worklog no Jira Cloud."
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    this.setupHandlers();
  }

  setupHandlers() {
    // Listar ferramentas disponíveis
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "jira.addWorklog",
            title: "Adicionar Worklog",
            description: "Adiciona um worklog em uma issue do Jira Cloud.",
            inputSchema: {
              type: "object",
              required: ["issueKey", "timeSpentSeconds"],
              properties: {
                issueKey: { type: "string", description: "Chave da issue (ex.: ABC-123)." },
                timeSpentSeconds: { type: "integer", description: "Tempo em segundos (ex.: 3600 = 1h)." },
                started: {
                  type: "string",
                  description: "Data/hora de início no formato ISO. Aceita 'YYYY-MM-DDTHH:mm:ss' (local) ou com offset (ex.: 2025-10-03T09:00:00-03:00)."
                },
                comment: {
                  type: "string",
                  description: "Comentário opcional do worklog (texto simples)."
                },
                visibility: {
                  type: "object",
                  description: "Visibilidade do worklog.",
                  properties: {
                    type: { type: "string", enum: ["role", "group"] },
                    value: { type: "string" }
                  }
                }
              }
            }
          },
          {
            name: "jira.searchJql",
            title: "Buscar Issues (JQL)",
            description: "Busca issues usando JQL e retorna campos principais.",
            inputSchema: {
              type: "object",
              required: ["jql"],
              properties: {
                jql: { type: "string", description: "Ex.: project = ABC AND assignee = currentUser() ORDER BY updated DESC" },
                maxResults: { type: "integer", default: 25 },
                fields: { type: "array", items: { type: "string" }, description: "Campos extras (ex.: ['summary','status'])" }
              }
            }
          },
          {
            name: "jira.getIssue",
            title: "Obter Issue",
            description: "Obtém dados de uma issue do Jira Cloud.",
            inputSchema: {
              type: "object",
              required: ["issueKey"],
              properties: {
                issueKey: { type: "string" },
                fields: { type: "array", items: { type: "string" } }
              }
            }
          }
        ]
      };
    });

    // Executar ferramentas
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "jira.addWorklog":
            return await this.addWorklog(args);
          case "jira.searchJql":
            return await this.searchJql(args);
          case "jira.getIssue":
            return await this.getIssue(args);
          default:
            throw new Error(`Ferramenta desconhecida: ${name}`);
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `❌ **Erro:** ${error.message}`
          }],
          isError: true
        };
      }
    });
  }

  async addWorklog(args) {
    const { issueKey, timeSpentSeconds, comment, started, visibility } = args;
    const startedStr = toJiraStartedISO(
      started || new Date().toISOString(),
      process.env.JIRA_USER_TZ || "UTC"
    );

    const body = {
      timeSpentSeconds,
      started: startedStr,
      ...(comment ? { comment: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: comment }] }] } } : {}),
      ...(visibility ? { visibility } : {})
    };

    const data = await jiraFetch("POST", `/rest/api/3/issue/${encodeURIComponent(issueKey)}/worklog`, body);

    return {
      content: [{
        type: "text",
        text: `Worklog criado em ${issueKey} com ${timeSpentSeconds}s (started=${startedStr}). id=${data?.id || "?"}`
      }]
    };
  }

  async searchJql(args) {
    const { jql, maxResults = 25, fields } = args;
    const body = {
      jql,
      maxResults,
      fields: fields ?? ["summary", "status", "assignee", "timetracking"]
    };
    const res = await jiraFetch("GET", `/rest/api/2/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&fields=${(fields || ["summary", "status", "assignee", "timetracking"]).join(",")}`);
    const issues = (res.issues || []).map((it) => ({
      key: it.key,
      id: it.id,
      self: it.self,
      summary: it.fields?.summary,
      status: it.fields?.status?.name,
      assignee: it.fields?.assignee?.displayName
    }));

    return {
      content: [{
        type: "text",
        text: `📋 **Resultados da busca JQL (${res.total} issues encontradas):**\n\n\`\`\`json\n${JSON.stringify({ total: res.total, issues }, null, 2)}\n\`\`\``
      }]
    };
  }

  async getIssue(args) {
    const { issueKey, fields } = args;
    const qs = fields?.length ? `?fields=${encodeURIComponent(fields.join(","))}` : "";
    const res = await jiraFetch("GET", `/rest/api/3/issue/${encodeURIComponent(issueKey)}${qs}`);
    return {
      content: [{
        type: "text",
        text: `📋 **Dados da issue ${issueKey}:**\n\n\`\`\`json\n${JSON.stringify(res, null, 2)}\n\`\`\``
      }]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('🚀 Servidor MCP Jira iniciado');
  }
}

// Iniciar servidor
const server = new JiraMCPServer();
server.run().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

// Cleanup
process.on('SIGINT', async () => {
  console.error('🔌 Desconectando...');
  process.exit(0);
});
