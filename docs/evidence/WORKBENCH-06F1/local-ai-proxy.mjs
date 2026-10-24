/**
 * WORKBENCH-06F1 运行态本地反代（仅取证用，不入产品代码）
 *
 * 作用：把浏览器的同源请求转发到**真实** AI 底座，并补 CORS 头。
 *
 * 为什么需要它：
 *   - 构建产物在 `http://127.0.0.1:4173`；AI 底座在 `https://admin.onepan.cn/ai-api`；
 *     浏览器跨域直连会被 CORS 拦（生产未给 4173 放行）⇒ 探针会变成 CORS error，
 *     无法区分「底座真的不可用」与「浏览器跨域被拦」。
 *   - 本代理只做**透明转发 + 补 CORS 头**，响应体由真实上游产生，
 *     **不拦截、不改写、不伪造任何业务数据**（用于证明 ready→绿 / 断流→非绿）。
 *
 * 用法：
 *   node docs/evidence/WORKBENCH-06F1/local-ai-proxy.mjs [--port 3017] [--upstream https://admin.onepan.cn/ai-api]
 *   # 构建时：VITE_AI_BASE_URL=http://127.0.0.1:3017 vite build
 */
import http from "node:http";
import https from "node:https";

const port = Number(process.env.PROXY_PORT ?? 3017);
const upstream = (process.env.PROXY_UPSTREAM ?? "https://admin.onepan.cn/ai-api").replace(/\/+$/, "");

const server = http.createServer((req, res) => {
  const target = new URL(upstream + (req.url ?? "/"));
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.origin;
  delete headers.referer;

  const upstreamReq = https.request(
    {
      hostname: target.hostname,
      port: target.port || 443,
      path: target.pathname + target.search,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      // 只补 CORS 头（浏览器同源策略要求），其余响应**原样透传**
      const outHeaders = { ...upstreamRes.headers };
      outHeaders["access-control-allow-origin"] = "*";
      outHeaders["access-control-allow-headers"] = "*";
      outHeaders["access-control-allow-methods"] = "*";
      outHeaders["access-control-expose-headers"] = "X-AI-Readiness";
      res.writeHead(upstreamRes.statusCode ?? 502, outHeaders);
      upstreamRes.pipe(res);
    },
  );
  upstreamReq.on("error", (err) => {
    res.writeHead(502, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(JSON.stringify({ error: `upstream unreachable: ${err.message}` }));
  });
  req.pipe(upstreamReq);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[local-ai-proxy] http://127.0.0.1:${port} → ${upstream}（真实上游，仅补 CORS 头）`);
});
