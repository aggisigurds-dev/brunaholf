#!/usr/bin/env node
// server.mjs — Brunahólf local MCP server.
//
// Runs on the heimaskrifstofa tölva, exposes a small set of safe tools that
// let Claude (cloud-side) do things on the machine: read local files, hit
// any URL (incl. brunaholf.netlify.app which Claude can't reach directly
// because of egress policy), open URLs in the default browser, upload files
// to Google Drive via brunahólf's existing OAuth.
//
// Stdio MCP transport — register with:
//   claude mcp add brunaholf-local node /full/path/local-mcp/server.mjs
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

const execP = promisify(exec);

// ─── Tool schemas ─────────────────────────────────────────────────────────
const tools = [
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
    description: 'Fetch a URL from this machine. Useful for hitting brunaholf.netlify.app endpoints that Claude can\'t reach directly. Body is sent as-is (string).',
    inputSchema: z.object({
      url: z.string().describe('Full URL incl. protocol.'),
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional().default('GET'),
      headers: z.record(z.string()).optional().describe('Header key/value pairs.'),
      body: z.string().optional().describe('Request body string (JSON or form-encoded).'),
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
    description: 'Stream a local file via brunaholf\'s Drive-proxy endpoint (uses existing OAuth, no new auth on this machine). Returns the new Drive fileId.',
    inputSchema: z.object({
      local_path: z.string().describe('Absolute path to the local file.'),
      drive_folder_id: z.string().describe('Target Google Drive folder ID.'),
      name: z.string().optional().describe('Name in Drive (defaults to local filename).'),
      upload_endpoint: z.string().optional().default('https://brunaholf.netlify.app/api/drive-upload-session')
        .describe('The brunahólf endpoint that initiates a Drive resumable upload session.'),
      token: z.string().optional().describe('X-Brunaholf-Token header value (matches LOCAL_UPLOAD_TOKEN env on brunaholf).'),
    }),
  },
];

// ─── Implementation ───────────────────────────────────────────────────────
async function listDir({ path }) {
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

async function fileInfo({ path }) {
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

async function readFileText({ path, max_kb = 200 }) {
  const p = resolve(path);
  const limit = max_kb * 1024;
  const buf = await readFile(p);
  const truncated = buf.length > limit;
  const text = buf.subarray(0, limit).toString('utf8');
  return { path: p, total_bytes: buf.length, returned_bytes: Math.min(buf.length, limit), truncated, text };
}

async function httpFetch({ url, method = 'GET', headers = {}, body, timeout_ms = 30000 }) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout_ms);
  try {
    const res = await fetch(url, { method, headers, body, signal: controller.signal });
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

async function openInBrowser({ url }) {
  const p = platform();
  const cmd =
    p === 'win32' ? `start "" "${url}"` :
    p === 'darwin' ? `open "${url}"` :
    `xdg-open "${url}"`;
  await execP(cmd);
  return { ok: true, opened: url };
}

async function uploadToDriveViaBrunaholf({ local_path, drive_folder_id, name, upload_endpoint, token }) {
  const p = resolve(local_path);
  const s = await stat(p);
  const fileName = name || basename(p);

  // Step 1: ask brunaholf to initiate a Drive resumable upload session.
  const sessionEndpoint = (upload_endpoint || 'https://brunaholf.netlify.app/api/drive-upload-session');
  const initRes = await fetch(sessionEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Brunaholf-Token': token } : {}),
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

// ─── MCP server wiring ────────────────────────────────────────────────────
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
  const name = req.params.name;
  const argsRaw = req.params.arguments || {};
  const tool = tools.find(t => t.name === name);
  if (!tool) return errReply(`Unknown tool: ${name}`);
  let args;
  try { args = tool.inputSchema.parse(argsRaw); }
  catch (e) { return errReply(`Invalid arguments for ${name}: ${e.message}`); }

  try {
    let result;
    switch (name) {
      case 'list_dir':  result = await listDir(args); break;
      case 'file_info': result = await fileInfo(args); break;
      case 'read_file_text': result = await readFileText(args); break;
      case 'http_fetch': result = await httpFetch(args); break;
      case 'open_in_browser': result = await openInBrowser(args); break;
      case 'upload_to_drive_via_brunaholf':
        result = await uploadToDriveViaBrunaholf(args); break;
      default: return errReply(`Unhandled tool: ${name}`);
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    return errReply(String(e?.message || e));
  }
});

function errReply(msg) {
  return { content: [{ type: 'text', text: `ERROR: ${msg}` }], isError: true };
}

// Minimal zod → JSON Schema conversion (enough for primitive shapes we use).
function zodToJsonSchema(z) {
  // Object root
  const def = z._def;
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

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[brunaholf-local-mcp] ready on stdio');
