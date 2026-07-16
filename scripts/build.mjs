import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
// Codex Sites reads the Cloudflare Vite client output from dist/client.
// Keeping the files under dist/static produced a successful deployment whose
// ASSETS binding was empty, so every request returned 404 in production.
const clientDir = path.join(dist, "client");

const files = [
  "index.html",
  "news.html",
  "service.html",
  "doctors.html",
  "access.html",
  "contact.html",
  "materials.html",
];

const directories = ["CSS", "JS", "images", "PDF"];

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, "server"), { recursive: true });
await mkdir(clientDir, { recursive: true });

for (const file of files) {
  await cp(path.join(root, file), path.join(clientDir, file));
}

for (const directory of directories) {
  await cp(path.join(root, directory), path.join(clientDir, directory), {
    recursive: true,
  });
}

const worker = `const HTML_HEADERS = {
  "Cache-Control": "no-cache",
  "Content-Security-Policy": "frame-ancestors 'self'",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
};

function withHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (pathname.endsWith(".html")) {
    for (const [key, value] of Object.entries(HTML_HEADERS)) headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const original = new URL(request.url);
    const candidates = [];

    if (original.pathname === "/") {
      candidates.push("/index.html");
    } else {
      candidates.push(original.pathname);
      if (!original.pathname.split("/").pop().includes(".")) {
        candidates.push(original.pathname.replace(/\\/$/, "") + ".html");
      }
    }

    for (const pathname of candidates) {
      const url = new URL(original);
      url.pathname = pathname;
      const response = await env.ASSETS.fetch(new Request(url, request));
      if (response.status !== 404) return withHeaders(response, pathname);
    }

    return new Response("ページが見つかりません", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
};
`;

await writeFile(path.join(dist, "server", "index.js"), worker);
await writeFile(
  path.join(dist, "server", "wrangler.json"),
  JSON.stringify(
    {
      main: "index.js",
      compatibility_date: "2026-07-16",
      assets: {
        directory: "../client",
        binding: "ASSETS",
        run_worker_first: true,
      },
    },
    null,
    2,
  ),
);
console.log("Codex Sites用の公開ファイルを dist に作成しました。");
