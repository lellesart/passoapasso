import { mkdir, writeFile } from 'node:fs/promises';

const workerSource = `const STATIC_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=31536000, immutable"
};

const HTML_HEADERS = {
  "Cache-Control": "no-store"
};

function isAssetRequest(pathname) {
  return pathname.includes(".");
}

async function fetchAsset(request, env) {
  if (!env.ASSETS || typeof env.ASSETS.fetch !== "function") {
    return new Response("Missing asset binding", { status: 500 });
  }

  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);
    let response = await fetchAsset(request, env);

    if (response.status === 404 && !isAssetRequest(url.pathname)) {
      response = await fetchAsset(new Request(new URL("/index.html", url), request), env);
    }

    if (!response.ok) return response;

    const headers = new Headers(response.headers);
    const contentType = headers.get("content-type") || "";

    if (contentType.includes("text/html")) {
      for (const [key, value] of Object.entries(HTML_HEADERS)) headers.set(key, value);
    } else if (url.pathname.startsWith("/assets/")) {
      for (const [key, value] of Object.entries(STATIC_CACHE_HEADERS)) headers.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
`;

await mkdir('dist/server', { recursive: true });
await writeFile('dist/server/index.js', workerSource);
