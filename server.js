#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { CONFIG_FILE, DEFAULT_BASE_URL, DEFAULT_API2_URL, USER_AGENT } from './config.js';

let saved = {};
try { saved = JSON.parse(readFileSync(CONFIG_FILE, 'utf8')); } catch {}

const RAW_TOKEN = process.env.SKOOL_AUTH_TOKEN || process.env.SKOOL_COOKIES || saved.cookies;
const DEFAULT_COMMUNITY = process.env.SKOOL_DEFAULT_COMMUNITY || saved.default_community;
const BASE_URL = (process.env.SKOOL_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
const API2_URL = DEFAULT_API2_URL;

if (!RAW_TOKEN) {
  console.error(
    'Skool MCP — not configured yet.\n\n' +
    'Run:  npx -y github:mnsmasum62786/was-skool-mcp auth\n'
  );
  process.exit(1);
}

const COOKIES = RAW_TOKEN.includes('=') ? RAW_TOKEN : `auth_token=${RAW_TOKEN}`;

// Next.js buildId cache
let buildIdCache = null;
let buildIdFetchedAt = 0;
const BUILD_ID_TTL = 30 * 60 * 1000; // 30 minutes

async function getBuildId() {
  if (buildIdCache && Date.now() - buildIdFetchedAt < BUILD_ID_TTL) {
    return buildIdCache;
  }

  const res = await fetch(BASE_URL, {
    headers: {
      'User-Agent': USER_AGENT,
      'Cookie': COOKIES,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to access Skool homepage: HTTP ${res.status}. Check your session cookies.`);
  }

  const html = await res.text();
  const match = html.match(/"buildId"\s*:\s*"([^"]+)"/);
  if (!match) {
    throw new Error('Could not extract buildId from Skool. Your session might be expired.');
  }

  buildIdCache = match[1];
  buildIdFetchedAt = Date.now();
  return buildIdCache;
}

// Next.js data route fetcher
async function nextDataRequest(path, queryParams = {}) {
  const buildId = await getBuildId();
  const cleanPath = path.replace(/^\/+|\/+$/g, '');
  const url = new URL(`${BASE_URL}/_next/data/${buildId}/${cleanPath}.json`);

  for (const [k, v] of Object.entries(queryParams)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      'Cookie': COOKIES,
      'Accept': 'application/json',
      'Referer': `${BASE_URL}/`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Skool data route failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }

  return await res.json();
}

// Raw HTTP request helper for mutations or arbitrary endpoints
async function rawRequest(method, urlStr, body, customHeaders = {}) {
  let url = urlStr;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  const headers = {
    'User-Agent': USER_AGENT,
    'Cookie': COOKIES,
    'Origin': BASE_URL,
    'Referer': `${BASE_URL}/`,
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    ...customHeaders,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(parsed?.message || parsed?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = parsed;
    throw err;
  }

  return parsed;
}

function resolveCommunity(provided) {
  const slug = provided || DEFAULT_COMMUNITY;
  if (!slug) {
    throw new Error('Community slug is required. Specify "community" or set a default during auth.');
  }
  return slug;
}

function asTextResult(data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const MAX = 60000;
  if (text.length > MAX) {
    return {
      content: [{
        type: 'text',
        text: text.slice(0, MAX) + `\n\n... [truncated ${text.length - MAX} chars; narrow your request or use pagination]`,
      }],
    };
  }
  return { content: [{ type: 'text', text }] };
}

function asError(err) {
  return {
    isError: true,
    content: [{
      type: 'text',
      text: 'Skool API error:\n' + JSON.stringify({
        message: err?.message || String(err),
        status: err?.status ?? null,
        raw: err?.body ?? null,
      }, null, 2),
    }],
  };
}

const tools = [
  {
    name: 'skool_community_info',
    description: 'Get details of a Skool community (name, description, member count, rules, cover image, and metadata).',
    inputSchema: {
      type: 'object',
      properties: {
        community: { type: 'string', description: 'Community slug (e.g. "my-community-slug"). Defaults to configured community.' },
      },
    },
  },
  {
    name: 'skool_list_posts',
    description: 'List posts in a community feed. Supports pagination, sorting, and category filters.',
    inputSchema: {
      type: 'object',
      properties: {
        community: { type: 'string', description: 'Community slug. Defaults to configured community.' },
        page: { type: 'number', default: 1, description: 'Page number (default: 1)' },
        sort: {
          type: 'string',
          enum: ['newest-cm', 'newest', 'top'],
          default: 'newest-cm',
          description: 'Sort order: newest-cm (recent activity), newest (date created), top (most liked)',
        },
        category: { type: 'string', description: 'Category/label ID or name to filter by' },
      },
    },
  },
  {
    name: 'skool_get_post',
    description: 'Get a specific post with its full text content, author details, and comments.',
    inputSchema: {
      type: 'object',
      properties: {
        postId: { type: 'string', description: 'Post ID or post slug' },
        community: { type: 'string', description: 'Community slug. Defaults to configured community.' },
      },
      required: ['postId'],
    },
  },
  {
    name: 'skool_create_post',
    description: 'Create and publish a new discussion post in the community.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the post' },
        content: { type: 'string', description: 'Body content of the post (markdown supported)' },
        category: { type: 'string', description: 'Category/label ID to post under' },
        community: { type: 'string', description: 'Community slug. Defaults to configured community.' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'skool_add_comment',
    description: 'Add a comment or reply to an existing post in the community.',
    inputSchema: {
      type: 'object',
      properties: {
        postId: { type: 'string', description: 'The ID of the post to comment on' },
        content: { type: 'string', description: 'Comment text content' },
        parentId: { type: 'string', description: 'Optional parent comment ID if replying to a specific comment' },
      },
      required: ['postId', 'content'],
    },
  },
  {
    name: 'skool_list_members',
    description: 'List members of the community, their roles, levels, and profiles.',
    inputSchema: {
      type: 'object',
      properties: {
        community: { type: 'string', description: 'Community slug. Defaults to configured community.' },
        page: { type: 'number', default: 1, description: 'Page number (default: 1)' },
      },
    },
  },
  {
    name: 'skool_list_pending_members',
    description: 'List pending membership requests awaiting approval.',
    inputSchema: {
      type: 'object',
      properties: {
        community: { type: 'string', description: 'Community slug. Defaults to configured community.' },
      },
    },
  },
  {
    name: 'skool_approve_member',
    description: 'Approve a pending membership join request.',
    inputSchema: {
      type: 'object',
      properties: {
        memberId: { type: 'string', description: 'User or membership request ID' },
        community: { type: 'string', description: 'Community slug. Defaults to configured community.' },
      },
      required: ['memberId'],
    },
  },
  {
    name: 'skool_reject_member',
    description: 'Reject a pending membership join request.',
    inputSchema: {
      type: 'object',
      properties: {
        memberId: { type: 'string', description: 'User or membership request ID' },
        community: { type: 'string', description: 'Community slug. Defaults to configured community.' },
      },
      required: ['memberId'],
    },
  },
  {
    name: 'skool_list_courses',
    description: 'List all classroom courses, modules, and lessons inside the community.',
    inputSchema: {
      type: 'object',
      properties: {
        community: { type: 'string', description: 'Community slug. Defaults to configured community.' },
      },
    },
  },
  {
    name: 'skool_get_lesson',
    description: 'Get details, video URL, notes, and resources of a specific lesson in a course.',
    inputSchema: {
      type: 'object',
      properties: {
        courseId: { type: 'string', description: 'Course slug or ID' },
        lessonId: { type: 'string', description: 'Lesson slug or ID' },
        community: { type: 'string', description: 'Community slug. Defaults to configured community.' },
      },
      required: ['courseId', 'lessonId'],
    },
  },
  {
    name: 'skool_universal_request',
    description: 'Universal API Call: Invoke ANY Skool URL or API endpoint directly (GET, POST, PUT, DELETE). Cookies and browser headers are automatically attached.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Full URL or relative path (e.g. "https://api2.skool.com/posts" or "/_next/data/...")' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
        body: { type: 'object', description: 'Request payload for POST/PUT' },
        headers: { type: 'object', description: 'Optional extra HTTP headers' },
      },
      required: ['url'],
    },
  },
];

async function handleCall(name, args) {
  switch (name) {
    case 'skool_community_info': {
      const slug = resolveCommunity(args.community);
      const data = await nextDataRequest(slug);
      return asTextResult(data?.pageProps?.group || data?.pageProps?.community || data);
    }

    case 'skool_list_posts': {
      const slug = resolveCommunity(args.community);
      const params = {
        group: slug,
        p: String(args.page || 1),
        s: args.sort || 'newest-cm',
      };
      if (args.category) params.c = args.category;
      const data = await nextDataRequest(slug, params);
      return asTextResult(data?.pageProps?.posts || data?.pageProps || data);
    }

    case 'skool_get_post': {
      const slug = resolveCommunity(args.community);
      const data = await nextDataRequest(`${slug}/${args.postId}`);
      return asTextResult(data?.pageProps?.post || data?.pageProps || data);
    }

    case 'skool_create_post': {
      const slug = resolveCommunity(args.community);
      const payload = {
        group: slug,
        title: args.title,
        content: args.content,
      };
      if (args.category) payload.labelId = args.category;
      return asTextResult(await rawRequest('POST', `${API2_URL}/posts`, payload));
    }

    case 'skool_add_comment': {
      const payload = {
        content: args.content,
      };
      if (args.parentId) payload.parentId = args.parentId;
      return asTextResult(await rawRequest('POST', `${API2_URL}/posts/${args.postId}/comments`, payload));
    }

    case 'skool_list_members': {
      const slug = resolveCommunity(args.community);
      const data = await nextDataRequest(`${slug}/members`, { p: String(args.page || 1) });
      return asTextResult(data?.pageProps?.members || data?.pageProps || data);
    }

    case 'skool_list_pending_members': {
      const slug = resolveCommunity(args.community);
      const data = await nextDataRequest(`${slug}/members`, { tab: 'pending' });
      return asTextResult(data?.pageProps?.pendingMembers || data?.pageProps?.requests || data?.pageProps || data);
    }

    case 'skool_approve_member': {
      const slug = resolveCommunity(args.community);
      return asTextResult(await rawRequest('POST', `${API2_URL}/groups/${slug}/members/${args.memberId}/approve`));
    }

    case 'skool_reject_member': {
      const slug = resolveCommunity(args.community);
      return asTextResult(await rawRequest('POST', `${API2_URL}/groups/${slug}/members/${args.memberId}/reject`));
    }

    case 'skool_list_courses': {
      const slug = resolveCommunity(args.community);
      const data = await nextDataRequest(`${slug}/classroom`);
      return asTextResult(data?.pageProps?.courses || data?.pageProps?.sets || data?.pageProps || data);
    }

    case 'skool_get_lesson': {
      const slug = resolveCommunity(args.community);
      const data = await nextDataRequest(`${slug}/classroom/${args.courseId}/${args.lessonId}`);
      return asTextResult(data?.pageProps?.lesson || data?.pageProps || data);
    }

    case 'skool_universal_request': {
      return asTextResult(await rawRequest(args.method || 'GET', args.url, args.body, args.headers));
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const server = new Server(
  { name: 'was-skool-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  try {
    return await handleCall(req.params.name, req.params.arguments || {});
  } catch (err) {
    return asError(err);
  }
});

await server.connect(new StdioServerTransport());
console.error(`was-skool-mcp v1.0.0 ready — ${tools.length} tools loaded`);
