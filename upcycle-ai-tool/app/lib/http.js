'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8'
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(body);
}

function apiError(res, status, code, message, extra) {
  return sendJson(res, status, Object.assign({ ok: false, code, error: message }, extra || {}));
}

function readJsonBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;
    req.on('data', (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > maxBytes) {
        done = true;
        reject(Object.assign(new Error('请求体过大'), { code: 'body_too_large', status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (done) return;
      done = true;
      if (size === 0) {
        reject(Object.assign(new Error('请求体为空'), { code: 'empty_body', status: 400 }));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('请求体不是合法 JSON'), { code: 'bad_json', status: 400 }));
      }
    });
    req.on('error', (err) => {
      if (done) return;
      done = true;
      reject(err);
    });
  });
}

function serveStatic(req, res, publicDir, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }
  const rel = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const full = path.resolve(publicDir, rel);
  if (!full.startsWith(path.resolve(publicDir) + path.sep) && full !== path.resolve(publicDir, 'index.html')) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.stat(full, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 找不到页面');
      return;
    }
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    fs.createReadStream(full).pipe(res);
  });
}

module.exports = { sendJson, apiError, readJsonBody, serveStatic };
