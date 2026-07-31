#!/usr/bin/env node
// server.mjs — Brunahólf local MCP server. ("skýja tengill" fyrir Claude local)
//
// Runs on the heimaskrifstofa tölva, exposes a small set of safe tools that
// let Claude (running locally in Claude Code on that machine) do things it
// otherwise can't: read local files, hit any URL (incl. brunaholf.netlify.app
// which the cloud egress policy blocks), open URLs in the default browser, and
// upload files to Google Drive via brunahólf's existing OAuth.
//
// Stdio MCP transport — register once per machine (see setja-upp-local-mcp.bat):
//   claude mcp add brunaholf-local -- node /full/path/local-mcp/server.mjs
//
// Tools exposed
//   list_dir(path)                       → list files + sizes in a directory
//   file_info(path)                      → size, mtime, type
//   read_file_text(path, max_kb=200)     → small text-file peek
//   http_fetch(url, method?, headers?, body?)
//                                         → fetch a URL from this machine
//   open_in_browser(url)                  → opens URL in default browser
//   upload_to_drive_via_brunaholf(localPath, folderId, name?)
//                                         → streams file to brunaholf's
//                                           Drive-proxy upload endpoint
//
// Security model
//   - Confined to safe operations only — no shell, no arbitrary file write.
//   - Filesystem reads are unrestricted by default (you trust who you give
//     this MCP to); upload tool calls go via brunaholf's signed endpoint.
//
// The tool implementations are exported so they can be unit-tested directly
// (see test.mjs); the stdio server only starts when this file is run as the
// main entry point.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve, basename, join } from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { platform } from 'node:os';
import { fileURLToPath } from 'node:url';

const execP = promisify(exec);

// Default brunahólf endpoint that mints a Google Drive resumable-upload session.
// Overridable per call or via env, so a different site/tunnel can be pointed at.
const DEFAULT_UPLOAD_ENDPOINT =
  process.env.BRUNAHOLF_UPLOAD_ENDPOINT ||
  'https://brunaholf.netlify.app/api/drive-upload-session';

// ─── Tool schemas ─────────────────────────────────────────────────────────
export const tools = [
  {
    name: 'list_dir',
    description: 'List entries in a directory on the heimaskrifstofa tölva. Returns name, kind (file|dir), size_bytes, modified.',
    inputSchema: z.object({
      path: z.string().describe('Absolute path to a directory.'),
    }),
  },
  {
    name: 'file_info',
    description: 'Get size + modified time + kind for a single file or directory.',
    inputSchema: z.object({
      path: z.string().describe('Absolute path.'),
    }),
  },
  {
    name: 'read_file_text',
    description: 'Read a UTF-8 text file (up to max_kb). For huge binaries use list_dir + upload_to_drive_via_brunaholf instead.',
    inputSchema: z.object({
      path: z.string().describe('Absolute path.'),
      max_kb: z.number().int().min(1).max(2000).optional().default(200),
    }),
  },
  {
    name: 'http_fetch',
    description: 'Fetch a URL from this machine. Useful for hitting brunaholf.netlify.app endpoints that Claude can\'t reach directly. Body is sent as-is (string); ignored for GET/HEAD.',
    inputSchema: z.object({
      url: z.string().describe('Full URL incl. protocol.'),
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional().default('GET'),
      headers: z.record(z.string()).optional().describe('Header key/value pairs.'),
      body: z.string().optional().describe('Request body string (JSON or form-encoded). Ignored for GET/HEAD.'),
      timeout_ms: z.number().int().min(1000).max(120000).optional().default(30000),
    }),
  },
  {
    name: 'open_in_browser',
    description: 'Open a URL in the user\'s default browser. Use to surface dashboards/results to the user.',
    inputSchema: z.object({
      url: z.string().describe('Full URL.'),
    }),
  },
  {
    name: 'upload_to_drive_via_brunaholf',
    description: 'Stream a local file via brunaholf\'s Drive-proxy endpoint (uses existing OAuth, no new auth on this machine). Returns the new Drive fileId. Needs the shared LOCAL_UPLOAD_TOKEN (env or arg).',
    inputSchema: z.object({
      local_path: z.string().describe('Absolute path to the local file.'),
      drive_folder_id: z.string().describe('Target Google Drive folder ID.'),
      name: z.string().optional().describe('Name in Drive (defaults to local filename).'),
      upload_endpoint: z.string().optional()
        .describe('The brunahólf endpoint that initiates a Drive resumable upload session. Defaults to env BRUNAHOLF_UPLOAD_ENDPOINT or the production URL.'),
      token: z.string().optional().describe('X-Brunaholf-Token header value (matches LOCAL_UPLOAD_TOKEN env on brunaholf). Defaults to the LOCAL_UPLOAD_TOKEN env var on this machine.'),
    }),
  },
];

// ─── Implementation ───────────────────────────────────────────────────────
export async function listDir({ path }) {
  const p = resolve(path);
  const entries = await readdir(p, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    try {
      const s = await stat(join(p, e.name));
      out.push({
        name: e.name,
        kind: e.isDirectory() ? 'dir' : (e.isFile() ? 'file' : 'other'),
        size_bytes: e.isFile() ? s.size : null,
        modified: s.mtime.toISOString(),
      });
    } catch (_) {
      out.push({ name: e.name, kind: e.isDirectory() ? 'dir' : 'file', size_bytes: null, modified: null });
    }
  }
  return { path: p, entries: out };
}

export async function fileInfo({ path }) {
  const p = resolve(path);
  const s = await stat(p);
  return {
    path: p,
    kind: s.isDirectory() ? 'dir' : (s.isFile() ? 'file' : 'other'),
    size_bytes: s.size,
    modified: s.mtime.toISOString(),
    created: s.birthtime.toISOString(),
  };
}

export async function readFileText({ path, max_kb = 200 }) {
  const p = resolve(path);
  const limit = max_kb * 1024;
  const buf = await readFile(p);
  const truncated = buf.length > limit;
  const text = buf.subarray(0, limit).toString('utf8');
  return { path: p, total_bytes: buf.length, returned_bytes: Math.min(buf.length, limit), truncated, text };
}

export async function httpFetch({ url, method = 'GET', headers = {}, body, timeout_ms = 30000 }) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout_ms);
  try {
    const opts = { method, headers, signal: controller.signal };
    // fetch() throws "Request with GET/HEAD method cannot have body" — only
    // attach a body when the method allows one.
    if (body != null && method !== 'GET' && method !== 'HEAD') opts.body = body;
    const res = await fetch(url, opts);
    const text = await res.text();
    const ct = res.headers.get('content-type') || '';
    let parsed = null;
    if (ct.includes('application/json')) {
      try { parsed = JSON.parse(text); } catch (_) {}
    }
    return {
      status: res.status,
      ok: res.ok,
      headers: Object.fromEntries(res.headers.entries()),
      body_text: text.length > 64_000 ? text.slice(0, 64_000) + '\n…[truncated]' : text,
      body_json: parsed,
    };
  } finally {
    clearTimeout(t);
  }
}

export async function openInBrowser({ url }) {
  const p = platform();
  const cmd =
    p === 'win32' ? `start "" "${url}"` :
    p === 'darwin' ? `open "${url}"` :
    `xdg-open "${url}"`;
  await execP(cmd);
  return { ok: true, opened: url };
}

export async function uploadToDriveViaBrunaholf({ local_path, drive_folder_id, name, upload_endpoint, token }) {
  const p = resolve(local_path);
  const s = await stat(p);
  const fileName = name || basename(p);
  const sessionEndpoint = upload_endpoint || DEFAULT_UPLOAD_ENDPOINT;
  const authToken = token || process.env.LOCAL_UPLOAD_TOKEN || '';

  // Step 1: ask brunaholf to initiate a Drive resumable upload session.
  const initRes = await fetch(sessionEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { 'X-Brunaholf-Token': authToken } : {}),
    },
    body: JSON.stringify({
      folderId: drive_folder_id,
      fileName,
      mimeType: 'application/octet-stream',
      size: s.size,
    }),
  });
  const initText = await initRes.text();
  let initJson = null;
  try { initJson = JSON.parse(initText); } catch (_) {}
  if (!initRes.ok || !initJson?.uploadUrl) {
    throw new Error(`Drive session init failed ${initRes.status}: ${(initJson?.error || initText).slice(0, 300)}`);
  }

  // Step 2: PUT the file bytes directly to Google. No bytes flow through Netlify.
  const stream = createReadStream(p);
  const putRes = await fetch(initJson.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': String(s.size),
      'Content-Type': 'application/octet-stream',
    },
    body: stream,
    duplex: 'half',
  });
  const putText = await putRes.text();
  let putJson = null;
  try { putJson = JSON.parse(putText); } catch (_) {}
  if (!putRes.ok) {
    throw new Error(`Drive upload PUT failed ${putRes.status}: ${putText.slice(0, 300)}`);
  }
  return {
    ok: true,
    name: fileName,
    size_bytes: s.size,
    drive_file_id: putJson?.id || null,
    drive_response: putJson,
  };
}

// Single dispatch path used by BOTH the MCP server and the test harness, so
// what gets tested is exactly what runs live (args are validated the same way).
export async function callTool(name, argsRaw = {}) {
  const tool = tools.find(t => t.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  const args = tool.inputSchema.parse(argsRaw);
  switch (name) {
    case 'list_dir': return listDir(args);
    case 'file_info': return fileInfo(args);
    case 'read_file_text': return readFileText(args);
    case 'http_fetch': return httpFetch(args);
    case 'open_in_browser': return openInBrowser(args);
    case 'upload_to_drive_via_brunaholf': return uploadToDriveViaBrunaholf(args);
    default: throw new Error(`Unhandled tool: ${name}`);
  }
}

// Minimal zod → JSON Schema conversion (enough for primitive shapes we use).
export function zodToJsonSchema(schema) {
  const def = schema._def;
  if (def.typeName === 'ZodObject') {
    const shape = def.shape();
    const properties = {};
    const required = [];
    for (const [k, v] of Object.entries(shape)) {
      const sub = zodToJsonSchema(v);
      const optional = v._def.typeName === 'ZodOptional' || v._def.typeName === 'ZodDefault';
      properties[k] = sub;
      if (!optional) required.push(k);
    }
    return { type: 'object', properties, required, additionalProperties: false };
  }
  if (def.typeName === 'ZodDefault') return zodToJsonSchema(def.innerType);
  if (def.typeName === 'ZodOptional') return zodToJsonSchema(def.innerType);
  if (def.typeName === 'ZodString') return { type: 'string', description: def.description };
  if (def.typeName === 'ZodNumber') return { type: 'number', description: def.description };
  if (def.typeName === 'ZodBoolean') return { type: 'boolean', description: def.description };
  if (def.typeName === 'ZodEnum') return { type: 'string', enum: def.values, description: def.description };
  if (def.typeName === 'ZodRecord') return { type: 'object', additionalProperties: { type: 'string' }, description: def.description };
  return { type: 'string', description: def.description };
}

function errReply(msg) {
  return { content: [{ type: 'text', text: `ERROR: ${msg}` }], isError: true };
}

// ─── MCP server wiring (only when run directly, not when imported) ──────────
export async function startServer() {
  const server = new Server(
    { name: 'brunaholf-local', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
      const result = await callTool(req.params.name, req.params.arguments || {});
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return errReply(String(e?.message || e));
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[brunaholf-local-mcp] ready on stdio');
  return server;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  await startServer();
}
