'use strict';

const http = require('node:http');
const { loadConfig, publicConfig } = require('./lib/config');
const { sendJson, apiError, readJsonBody, serveStatic } = require('./lib/http');
const { handleIdeas, handleRefine, handleOcr, ApiError } = require('./lib/orchestrator');
const { TOOLS, LANES, SAMPLE_META, DEFAULT_TOOLS } = require('./lib/data/catalog');

const config = loadConfig();
// 本地预览仍只监听回环；云托管容器通过 HOST=0.0.0.0 对外开放同一个端口。
const host = process.env.HOST || '127.0.0.1';

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = url.pathname;

  if (pathname === '/api/config' && req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      config: publicConfig(config),
      tools: TOOLS.filter((t) => t.id !== 'hands'),
      defaultTools: DEFAULT_TOOLS,
      lanes: LANES,
      samples: SAMPLE_META
    });
  }

  if ((pathname === '/api/ideas' || pathname === '/api/refine' || pathname === '/api/ocr') && req.method === 'POST') {
    let body;
    try {
      body = await readJsonBody(req, config.limits.maxBodyBytes);
    } catch (err) {
      return apiError(res, err.status || 400, err.code || 'bad_request', err.message || '请求体读取失败');
    }
    try {
      const data = pathname === '/api/ideas'
        ? await handleIdeas(config, body)
        : (pathname === '/api/refine' ? await handleRefine(config, body) : await handleOcr(config, body));
      return sendJson(res, 200, data);
    } catch (err) {
      if (err instanceof ApiError) {
        return apiError(res, err.status, err.code, err.message, { retryable: true });
      }
      console.error('[api] unexpected error:', err);
      return apiError(res, 500, 'internal_error', '服务端处理失败，可以重试', { retryable: true });
    }
  }

  if (pathname.startsWith('/api/')) {
    return apiError(res, 404, 'not_found', '没有这个接口');
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    return res.end('Method Not Allowed');
  }
  serveStatic(req, res, config.publicDir, pathname);
});

server.listen(config.port, host, () => {
  const modeLabel = config.mode === 'demo' ? '示例模式（未配置模型接口）' : `已连接模型 ${config.model}`;
  console.log(`万物改造局 · http://${host}:${config.port}`);
  console.log(`运行模式：${modeLabel}${config.mode === 'live' ? ` · 视觉输入 ${config.vision ? '启用' : '未启用'}` : ''}`);
  console.log(`文字识别：${config.ocrAvailable ? `凭据已配置（${config.ocrCredentialSource}），实际权限以调用结果为准` : '未配置凭据'}`);
});
