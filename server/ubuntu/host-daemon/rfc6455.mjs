import crypto from 'node:crypto';
import EventEmitter from 'node:events';
import http from 'node:http';
import https from 'node:https';

const WS_MAGIC_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
export const MAX_WS_FRAME_BYTES = 1024 * 1024; // 1 MiB bounded control/terminal frame

/**
 * Compute RFC 6455 Sec-WebSocket-Accept header value.
 */
export function computeWebSocketAcceptKey(clientKey) {
  return crypto
    .createHash('sha1')
    .update(String(clientKey || '').trim() + WS_MAGIC_GUID, 'utf8')
    .digest('base64');
}

/**
 * Encode one WebSocket frame per RFC 6455. Server frames are unmasked; client frames are masked.
 */
export function encodeWebSocketFrame(opcode, payload = Buffer.alloc(0), { mask = false, fin = true } = {}) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload ?? ''), 'utf8');
  if (data.length > MAX_WS_FRAME_BYTES) {
    throw new RangeError(`WebSocket frame exceeds ${MAX_WS_FRAME_BYTES} byte limit.`);
  }

  const firstByte = (fin ? 0x80 : 0x00) | (opcode & 0x0f);
  const maskBit = mask ? 0x80 : 0x00;

  let header;
  if (data.length < 126) {
    header = Buffer.alloc(2);
    header[0] = firstByte;
    header[1] = maskBit | data.length;
  } else if (data.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = firstByte;
    header[1] = maskBit | 126;
    header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = firstByte;
    header[1] = maskBit | 127;
    header.writeBigUInt64BE(BigInt(data.length), 2);
  }

  if (!mask) {
    return Buffer.concat([header, data]);
  }

  const maskKey = crypto.randomBytes(4);
  const masked = Buffer.allocUnsafe(data.length);
  for (let i = 0; i < data.length; i += 1) {
    masked[i] = data[i] ^ maskKey[i & 3];
  }
  return Buffer.concat([header, maskKey, masked]);
}

/**
 * Wrap a raw TCP socket after HTTP 101 Switching Protocols into an EventEmitter WebSocket.
 */
export function wrapWebSocket(socket, initialHead = Buffer.alloc(0), { isClient = false } = {}) {
  const emitter = new EventEmitter();
  let buffer = initialHead && initialHead.length > 0 ? Buffer.from(initialHead) : Buffer.alloc(0);
  let closed = false;
  let fragmentedOpcode = null;
  let fragmentedChunks = [];

  const cleanupClose = (code = 1000, reason = '') => {
    if (closed) return;
    closed = true;
    try {
      if (!socket.destroyed) {
        const msgBuf = Buffer.from(String(reason || '').slice(0, 100), 'utf8');
        const closePayload = Buffer.allocUnsafe(2 + msgBuf.length);
        closePayload.writeUInt16BE(code, 0);
        msgBuf.copy(closePayload, 2);
        socket.write(encodeWebSocketFrame(0x8, closePayload, { mask: isClient }));
      }
    } catch {}
    try {
      socket.end();
    } catch {}
    emitter.emit('close', { code, reason });
  };

  const pendingMessages = [];
  const emitMessage = (msg) => {
    if (emitter.listenerCount('message') > 0) {
      emitter.emit('message', msg);
    } else if (pendingMessages.length < 256) {
      pendingMessages.push(msg);
    }
  };
  emitter.on('newListener', (event) => {
    if (event === 'message' && pendingMessages.length > 0) {
      queueMicrotask(() => {
        while (pendingMessages.length > 0 && emitter.listenerCount('message') > 0) {
          emitter.emit('message', pendingMessages.shift());
        }
      });
    }
  });

  const processBuffer = () => {
    while (buffer.length >= 2 && !closed) {
      const b0 = buffer[0];
      const b1 = buffer[1];
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let payloadLen = b1 & 0x7f;
      let offset = 2;

      if (payloadLen === 126) {
        if (buffer.length < 4) return;
        payloadLen = buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLen === 127) {
        if (buffer.length < 10) return;
        const bigLen = buffer.readBigUInt64BE(2);
        if (bigLen > BigInt(MAX_WS_FRAME_BYTES)) {
          cleanupClose(1009, 'Frame too large');
          return;
        }
        payloadLen = Number(bigLen);
        offset = 10;
      }

      if (payloadLen > MAX_WS_FRAME_BYTES) {
        cleanupClose(1009, 'Frame too large');
        return;
      }

      const maskLen = masked ? 4 : 0;
      if (buffer.length < offset + maskLen + payloadLen) return;

      const maskKey = masked ? buffer.subarray(offset, offset + 4) : null;
      const payloadStart = offset + maskLen;
      const rawPayload = Buffer.from(buffer.subarray(payloadStart, payloadStart + payloadLen));
      buffer = buffer.subarray(payloadStart + payloadLen);

      if (masked && maskKey) {
        for (let i = 0; i < rawPayload.length; i += 1) {
          rawPayload[i] ^= maskKey[i & 3];
        }
      }

      // Control frames (0x8 close, 0x9 ping, 0xA pong) can arrive between fragments
      if (opcode === 0x8) {
        const closeCode = rawPayload.length >= 2 ? rawPayload.readUInt16BE(0) : 1000;
        const closeReason = rawPayload.length > 2 ? rawPayload.subarray(2).toString('utf8') : '';
        if (!closed) {
          closed = true;
          try {
            if (!socket.destroyed) socket.end(encodeWebSocketFrame(0x8, Buffer.alloc(0), { mask: isClient }));
          } catch {}
          emitter.emit('close', { code: closeCode, reason: closeReason });
        }
        return;
      }
      if (opcode === 0x9) {
        try {
          if (!socket.destroyed) socket.write(encodeWebSocketFrame(0xa, rawPayload, { mask: isClient }));
        } catch {}
        continue;
      }
      if (opcode === 0xa) {
        emitter.emit('pong', rawPayload);
        continue;
      }

      if (opcode === 0x0) {
        if (fragmentedOpcode === null) {
          cleanupClose(1002, 'Unexpected continuation frame');
          return;
        }
        fragmentedChunks.push(rawPayload);
        const total = fragmentedChunks.reduce((s, c) => s + c.length, 0);
        if (total > MAX_WS_FRAME_BYTES) {
          cleanupClose(1009, 'Message too large');
          return;
        }
        if (fin) {
          const assembled = Buffer.concat(fragmentedChunks);
          const resolvedOp = fragmentedOpcode;
          fragmentedOpcode = null;
          fragmentedChunks = [];
          emitMessage({
            opcode: resolvedOp,
            data: resolvedOp === 0x1 ? assembled.toString('utf8') : assembled
          });
        }
        continue;
      }

      if (!fin) {
        fragmentedOpcode = opcode;
        fragmentedChunks = [rawPayload];
        continue;
      }

      emitMessage({
        opcode,
        data: opcode === 0x1 ? rawPayload.toString('utf8') : rawPayload
      });
    }
  };

  socket.on('data', (chunk) => {
    if (closed) return;
    buffer = buffer.length > 0 ? Buffer.concat([buffer, chunk]) : Buffer.from(chunk);
    if (buffer.length > MAX_WS_FRAME_BYTES * 2) {
      cleanupClose(1009, 'Buffer overflow');
      return;
    }
    processBuffer();
  });

  socket.on('error', (err) => {
    if (emitter.listenerCount('error') > 0) {
      emitter.emit('error', err);
    }
    if (!closed) {
      closed = true;
      emitter.emit('close', { code: 1006, reason: err?.message || 'Socket error' });
    }
  });

  socket.on('close', () => {
    if (!closed) {
      closed = true;
      emitter.emit('close', { code: 1000, reason: 'Connection closed' });
    }
  });

  if (buffer.length > 0) {
    queueMicrotask(processBuffer);
  }

  return Object.assign(emitter, {
    get isClosed() {
      return closed || socket.destroyed;
    },
    sendText(str) {
      if (closed || socket.destroyed) return false;
      try {
        socket.write(encodeWebSocketFrame(0x1, Buffer.from(String(str ?? ''), 'utf8'), { mask: isClient }));
        return true;
      } catch {
        return false;
      }
    },
    sendBinary(buf) {
      if (closed || socket.destroyed) return false;
      try {
        socket.write(encodeWebSocketFrame(0x2, Buffer.isBuffer(buf) ? buf : Buffer.from(buf), { mask: isClient }));
        return true;
      } catch {
        return false;
      }
    },
    ping(data = Buffer.alloc(0)) {
      if (closed || socket.destroyed) return false;
      try {
        socket.write(encodeWebSocketFrame(0x9, data, { mask: isClient }));
        return true;
      } catch {
        return false;
      }
    },
    close: cleanupClose
  });
}

/**
 * Accept an incoming HTTP WebSocket upgrade request and return wrapped WebSocket connection.
 */
export function acceptWebSocketUpgrade(req, socket, head = Buffer.alloc(0)) {
  const wsKey = req.headers?.['sec-websocket-key'];
  if (!wsKey || typeof wsKey !== 'string') {
    socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return null;
  }
  const accept = computeWebSocketAcceptKey(wsKey);
  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '\r\n'
    ].join('\r\n')
  );
  if (typeof socket.setNoDelay === 'function') socket.setNoDelay(true);
  return wrapWebSocket(socket, head, { isClient: false });
}

/**
 * Connect as an RFC 6455 WebSocket client over ws:// or wss:// using pure Node core modules.
 */
export function connectWebSocketClient(urlString, { headers = {}, timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlString);
    const isTls = parsed.protocol === 'wss:';
    const transport = isTls ? https : http;
    const key = crypto.randomBytes(16).toString('base64');
    const req = transport.request({
      hostname: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : (isTls ? 443 : 80),
      path: `${parsed.pathname}${parsed.search}`,
      method: 'GET',
      timeout: timeoutMs,
      headers: {
        ...headers,
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': key
      }
    });

    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      try { req.destroy(); } catch {}
      reject(err);
    };

    req.on('timeout', () => fail(new Error('WebSocket upgrade timed out')));
    req.on('error', fail);
    req.on('response', (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8').slice(0, 300);
        fail(new Error(`WebSocket upgrade rejected (HTTP ${res.statusCode}): ${body || 'error'}`));
      });
    });
    req.on('upgrade', (res, socket, head) => {
      if (settled) {
        try { socket.destroy(); } catch {}
        return;
      }
      const expected = computeWebSocketAcceptKey(key);
      if (res.headers['sec-websocket-accept'] !== expected) {
        try { socket.destroy(); } catch {}
        return fail(new Error('Invalid Sec-WebSocket-Accept from upstream'));
      }
      settled = true;
      if (typeof socket.setNoDelay === 'function') socket.setNoDelay(true);
      resolve(wrapWebSocket(socket, head, { isClient: true }));
    });
    req.end();
  });
}
