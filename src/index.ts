import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfig } from './config';
import { ModelRegistry } from './core/model-registry';
import { AotWriter } from './core/aot-writer';
import { LabelManager } from './core/label-manager';

import {
  ObjectToolInputSchema,
  handleObjectTool,
} from './tools/object-tool';
import {
  BuildToolInputSchema,
  handleBuildTool,
} from './tools/build-tool';
import {
  ExploreToolInputSchema,
  handleExploreTool,
} from './tools/explore-tool';

async function main() {
  // ── Bootstrap ────────────────────────────────────────────────────────────
  const config = loadConfig();

  const registry = new ModelRegistry(config.packagesRoot);
  await registry.load();

  const writer = new AotWriter();
  const labels = new LabelManager(config.packagesRoot, config.defaultLocale);

  const customModels = registry.listCustom();
  console.error(
    `[xpp-mcp] Loaded ${registry.list().length} models ` +
    `(${customModels.length} custom: ${customModels.map(m => m.name).join(', ')})`
  );

  // ── MCP server ──────────────────────────────────────────────────────────
  const server = new Server(
    { name: 'xpp-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  // ── Tool definitions ─────────────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'd365_object',
        description:
          'Create, inspect, or delete D365 F&O AOT objects (AxTable, AxClass, AxEnum, AxEdt). ' +
          'Single call creates complete objects including fields, indexes, and label files.',
        inputSchema: {
          type: 'object',
          properties: {
            action:   { type: 'string', enum: ['create', 'inspect', 'delete', 'list_types'] },
            type:     { type: 'string', description: 'e.g. AxTable, AxClass, AxEnum, AxEdt' },
            model:    { type: 'string', description: `Default: ${config.defaultModel}` },
            name:     { type: 'string' },
            label:    { type: 'string', description: 'Plain text — auto-creates label entry' },
            fields:   { type: 'array',  description: 'AxTable fields' },
            indexes:  { type: 'array',  description: 'AxTable indexes' },
            values:   { type: 'array',  description: 'AxEnum values' },
            edtType:  { type: 'string', description: 'AxEdt subtype: String|Int|Real|Date|DateTime|Int64|Enum|Guid|Container' },
            classDeclaration: { type: 'string', description: 'AxClass declaration block' },
            methods:  { type: 'array',  description: 'Methods for AxTable or AxClass' },
            useLabels:{ type: 'boolean', description: 'Auto-manage label files (default true)' },
          },
          required: ['action'],
        },
      },
      {
        name: 'd365_build',
        description:
          'Compile D365 model, sync database, or run best practice checks. ' +
          'Uses xppc.exe and SyncEngine.exe — no VS2022 required.',
        inputSchema: {
          type: 'object',
          properties: {
            action:      { type: 'string', enum: ['compile', 'sync_db', 'best_practice', 'full_build', 'validate_metadata'] },
            model:       { type: 'string' },
            incremental: { type: 'boolean', description: 'Incremental compile (default false)' },
            verbose:     { type: 'boolean', description: 'Show full output (default false)' },
          },
          required: ['action', 'model'],
        },
      },
      {
        name: 'd365_explore',
        description:
          'Search, list, and read D365 AOT objects. ' +
          'Explore models, list object types, search by name pattern.',
        inputSchema: {
          type: 'object',
          properties: {
            action:          { type: 'string', enum: ['list_models', 'list_objects', 'search', 'read', 'list_types'] },
            model:           { type: 'string' },
            type:            { type: 'string', description: 'e.g. AxTable, AxClass' },
            pattern:         { type: 'string', description: 'Supports * and ? wildcards' },
            name:            { type: 'string' },
            includeStandard: { type: 'boolean', description: 'Include Microsoft models (default false)' },
            limit:           { type: 'number',  description: 'Max results (default 50)' },
          },
          required: ['action'],
        },
      },
    ],
  }));

  // ── Tool call handler ─────────────────────────────────────────────────────
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      if (name === 'd365_object') {
        // Coerce string→array for params that Claude.ai web serialises as JSON strings.
        // Claude.ai's MCP client can serialise BOTH top-level arrays AND nested arrays
        // inside object elements as JSON strings instead of native arrays.
        const raw = { ...args, model: (args as Record<string,unknown>).model ?? config.defaultModel } as Record<string,unknown>;

        // Recursively parse any string value that looks like a JSON array/object
        function coerceJsonStrings(obj: unknown): unknown {
          if (typeof obj === 'string') {
            const trimmed = obj.trim();
            if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
                (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
              try { return coerceJsonStrings(JSON.parse(trimmed)); } catch { return obj; }
            }
            return obj;
          }
          if (Array.isArray(obj)) return obj.map(coerceJsonStrings);
          if (obj !== null && typeof obj === 'object') {
            const result: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
              result[k] = coerceJsonStrings(v);
            }
            return result;
          }
          return obj;
        }

        // Apply coercion to all known array-typed top-level keys first (fast path),
        // then deep-coerce the entire raw object to catch nested array-strings.
        const ARRAY_KEYS = [
          'fields','indexes','relations','deleteActions','fieldGroups','methods','values',
          'dataSources','listFields','detailFastTabs','actionPaneButtons',
          'entryPoints','privileges','duties','elements','queryDataSources',
        ];
        for (const key of ARRAY_KEYS) {
          if (typeof raw[key] === 'string') {
            try { raw[key] = JSON.parse(raw[key] as string); } catch { /* leave as-is */ }
          }
        }
        // Deep-coerce to handle nested arrays (e.g. fields[] inside dataSources[])
        const coerced = coerceJsonStrings(raw) as Record<string, unknown>;

        // Unescape literal \n \t \r sequences AND HTML entities in all string values.
        // Claude.ai serialises multiline strings with literal \n instead of real newlines,
        // and HTML-encodes < > & " inside strings (e.g. &lt;summary&gt; in XML doc comments).
        function unescapeStrings(obj: unknown): unknown {
          if (typeof obj === 'string') {
            return obj
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r')
              .replace(/\\t/g, '\t')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&amp;/g, '&')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'");
          }
          if (Array.isArray(obj)) return obj.map(unescapeStrings);
          if (obj !== null && typeof obj === 'object') {
            const out: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
              out[k] = unescapeStrings(v);
            }
            return out;
          }
          return obj;
        }
        const unescaped = unescapeStrings(coerced) as Record<string, unknown>;

        const input = ObjectToolInputSchema.parse(unescaped);
        result = await handleObjectTool(input, { registry, writer, labels });

      } else if (name === 'd365_build') {
        const input = BuildToolInputSchema.parse(args);
        result = await handleBuildTool(input, config);

      } else if (name === 'd365_explore') {
        const input = ExploreToolInputSchema.parse(args);
        result = await handleExploreTool(input, registry);

      } else {
        result = `Unknown tool: ${name}`;
      }

      return { content: [{ type: 'text', text: result }] };

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `Error: ${msg}` }],
        isError: true,
      };
    }
  });

  // ── Start ─────────────────────────────────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[xpp-mcp] Server ready');
}

main().catch((err) => {
  console.error('[xpp-mcp] Fatal:', err);
  process.exit(1);
});
