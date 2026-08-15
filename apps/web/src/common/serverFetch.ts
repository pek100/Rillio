// Copyright (C) 2017-2026 Smart code 203358507

// One door to the local streaming server.
//
// In a browser this is `fetch` with the address resolved (see
// common/serverAddress). Inside the desktop shell the server's router runs
// in-process, so the request is handed to it over Tauri IPC instead of going
// out to a socket: no port to guess, no origin guard to satisfy, and it works
// on a boot where the server had to take an ephemeral port.
//
// Shaped like fetch on purpose - callers already branch on `resp.ok` and read
// `resp.json()`, and those semantics are preserved exactly.

import { getTauri } from 'rillio/common/Platform/shell/isShell';
import {
    getServerUrl,
    isLocalServerUrl,
    rewriteServerUrl,
    whenServerUrlReady,
} from 'rillio/common/serverAddress';

// Response refuses to carry a body for these, and constructing one throws.
const BODYLESS_STATUSES = new Set([204, 205, 304]);

type IpcResponse = {
    status?: unknown,
    headers?: unknown,
    body?: unknown,
};

// The shell hands headers back as a plain object; a repeated header may arrive
// as a list. Headers only accepts strings, so fold those the way HTTP does.
const toHeaders = (raw: unknown): Record<string, string> => {
    if (raw === null || typeof raw !== 'object') return {};
    return Object.entries(raw as Record<string, unknown>).reduce<Record<string, string>>((headers, [name, value]) => {
        if (typeof value === 'string') {
            headers[name] = value;
        } else if (Array.isArray(value)) {
            headers[name] = value.filter((item) => typeof item === 'string').join(', ');
        }
        return headers;
    }, {});
};

const responseFromIpc = (path: string, result: unknown): Response => {
    const { status, headers, body } = (result ?? {}) as IpcResponse;
    if (typeof status !== 'number' || !isFinite(status)) {
        // FAIL LOUD: a malformed answer must not read as a successful request.
        throw new Error(`serverFetch: the shell returned no status for ${path}`);
    }
    const payload = BODYLESS_STATUSES.has(status) || typeof body !== 'string' ? null : body;
    return new Response(payload, { status, headers: toHeaders(headers) });
};

/**
 * Fetch against the local streaming server. `input` is a full url built the way
 * the callers already build it (`new URL('cache/list', serverUrl)`); a bare
 * path is resolved against the current server address.
 *
 * Requests aimed at the DEFAULT (symbolic) server are rewritten to the real
 * address and, in the shell, routed over IPC. A user-configured remote server
 * is left completely alone: it has to go over the network.
 */
export const serverFetch = async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const requested = typeof input === 'string' ? new URL(input, getServerUrl()).toString() : input.toString();
    // Local = the symbolic default origin OR the shell-resolved actual origin
    // (callers that already hold the real address must still ride IPC), with
    // an origin-boundary guard so a crafted host cannot impersonate either.
    const isLocalServer = isLocalServerUrl(requested);
    if (!isLocalServer) {
        return fetch(requested, init);
    }

    // Wait for the handshake before committing to an address: firing at the
    // symbolic port on a boot that fell back to an ephemeral one would hit
    // whatever else holds 11470.
    await whenServerUrlReady();
    const target = rewriteServerUrl(requested);

    const invoke = getTauri()?.core?.invoke;
    if (typeof invoke !== 'function') {
        return fetch(target, init);
    }

    const body = init?.body;
    if (body !== undefined && body !== null && typeof body !== 'string') {
        throw new Error('serverFetch: only string request bodies can be sent over the shell IPC transport');
    }

    const parsed = new URL(target);
    const path = `${parsed.pathname}${parsed.search}`;
    const method = (init?.method ?? 'GET').toUpperCase();
    const result = await invoke('server_request', {
        method,
        path,
        body: typeof body === 'string' ? body : null,
    });
    return responseFromIpc(path, result);
};

export default serverFetch;
