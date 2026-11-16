'use strict';

// 不引入图像库：只读取文件头判断真实格式与像素尺寸，用于服务端限额校验。
// 注意：扩展名和 MIME 声明都不可信，必须校验 magic bytes。

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return { error: '图片格式不正确' };
  }
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return { error: '图片格式不正确' };
  const header = dataUrl.slice(5, comma);
  if (!/;base64$/i.test(header)) return { error: '图片需要 base64 编码' };
  const mime = header.replace(/;base64$/i, '').toLowerCase();
  if (!ALLOWED.has(mime)) return { error: '仅支持 JPEG / PNG / WebP' };
  const raw = dataUrl.slice(comma + 1);
  let buffer;
  try {
    buffer = Buffer.from(raw, 'base64');
  } catch {
    return { error: '图片编码不合法' };
  }
  return { mime, buffer };
}

function imageInfo(mime, buf) {
  if (mime === 'image/png') {
    if (buf.length < 24 || !buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return { error: 'PNG 文件头不合法' };
    }
    if (buf.subarray(12, 16).toString('ascii') !== 'IHDR') return { error: 'PNG 缺少 IHDR' };
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  if (mime === 'image/jpeg') {
    if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return { error: 'JPEG 文件头不合法' };
    let i = 2;
    while (i + 3 < buf.length) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      let marker = buf[i + 1];
      while (marker === 0xff) { i += 1; marker = buf[i + 1]; }
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      if (len < 2 || i + 2 + len > buf.length) break;
      const sof = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf];
      if (sof.includes(marker)) {
        if (len < 7) break;
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      }
      i += 2 + len;
    }
    return { error: '无法读取 JPEG 尺寸' };
  }

  if (mime === 'image/webp') {
    if (buf.length < 30 || buf.subarray(0, 4).toString('ascii') !== 'RIFF' || buf.subarray(8, 12).toString('ascii') !== 'WEBP') {
      return { error: 'WebP 文件头不合法' };
    }
    const chunk = buf.subarray(12, 16).toString('ascii');
    if (chunk === 'VP8X') {
      return {
        width: buf.readUIntLE(24, 3) + 1,
        height: buf.readUIntLE(27, 3) + 1
      };
    }
    if (chunk === 'VP8 ') {
      if (buf.length < 30 || buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) {
        return { error: 'WebP 有损帧头不合法' };
      }
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === 'VP8L') {
      if (buf.length < 25 || buf[20] !== 0x2f) return { error: 'WebP 无损帧头不合法' };
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return { error: '不支持的 WebP 编码格式' };
  }

  return { error: '不支持的图片格式' };
}

function validateImage(dataUrl, limits) {
  const parsed = parseDataUrl(dataUrl);
  if (parsed.error) return { error: parsed.error, code: 'bad_image' };
  const { mime, buffer } = parsed;
  if (buffer.length < limits.minImageBytes) return { error: '图片文件过小或内容为空', code: 'bad_image' };
  if (buffer.length > limits.maxImageBytes) {
    return { error: `图片超过 ${Math.round(limits.maxImageBytes / 1024 / 1024)}MB 上限`, code: 'image_too_large' };
  }
  const info = imageInfo(mime, buffer);
  if (info.error) return { error: info.error, code: 'bad_image' };
  if (!Number.isFinite(info.width) || !Number.isFinite(info.height) ||
      info.width < limits.minDimension || info.height < limits.minDimension) {
    return { error: '图片像素尺寸异常', code: 'bad_image' };
  }
  if (info.width > limits.maxDimension || info.height > limits.maxDimension) {
    return { error: `图片单边像素不能超过 ${limits.maxDimension}`, code: 'image_too_large' };
  }
  return { mime, bytes: buffer.length, width: info.width, height: info.height, buffer };
}

module.exports = { validateImage, imageInfo, parseDataUrl };
