import { PLATFORM_CONFIG } from '../config/platformConfig.js';

export const WINDOWS_RELAY_SCRIPT_VERSION = 'v1';
export const UNIX_RELAY_SCRIPT_VERSION = 'v1';

export function resolvePublicSshDomain(overrideDomain = null) {
  const raw = String(
    overrideDomain ||
    process.env.TIWLO_SSH_PUBLIC_DOMAIN ||
    process.env.TIWLO_PRIMARY_DOMAIN ||
    PLATFORM_CONFIG.primaryDomain ||
    'tiwlo.com'
  )
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/[^a-z0-9.-]/g, '');
  return raw || 'tiwlo.com';
}

export const WINDOWS_RELAY_SCRIPT_CONTENT = `param([string]$Url)
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($Url)) {
  [Console]::Error.WriteLine('Usage: tiwlo-ssh-v1.ps1 <wss://...>')
  exit 2
}
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Net.WebSockets;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Win32.SafeHandles;
public static class TiwloSshBridge {
  [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int nStdHandle);
  public static void Run(string url) {
    var ws = new ClientWebSocket();
    ws.Options.KeepAliveInterval = TimeSpan.FromSeconds(20);
    ws.ConnectAsync(new Uri(url), CancellationToken.None).GetAwaiter().GetResult();
    var stdin = new FileStream(new SafeFileHandle(GetStdHandle(-10), false), FileAccess.Read, 65536, false);
    var stdout = new FileStream(new SafeFileHandle(GetStdHandle(-11), false), FileAccess.Write, 65536, false);
    var rx = Task.Run(async () => {
      var buf = new byte[65536];
      try {
        while (ws.State == WebSocketState.Open) {
          var res = await ws.ReceiveAsync(new ArraySegment<byte>(buf), CancellationToken.None);
          if (res.MessageType == WebSocketMessageType.Close) break;
          if (res.Count > 0) {
            stdout.Write(buf, 0, res.Count);
            stdout.Flush();
          }
        }
      } catch {}
    });
    try {
      var buf = new byte[65536];
      int n;
      while (ws.State == WebSocketState.Open && (n = stdin.Read(buf, 0, buf.Length)) > 0) {
        ws.SendAsync(new ArraySegment<byte>(buf, 0, n), WebSocketMessageType.Binary, true, CancellationToken.None).GetAwaiter().GetResult();
      }
    } catch {}
    try { ws.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, string.Empty, CancellationToken.None).GetAwaiter().GetResult(); } catch {}
    rx.Wait(1000);
  }
}
'@
[TiwloSshBridge]::Run($Url)
`;

export const UNIX_RELAY_SCRIPT_CONTENT = `#!/usr/bin/env python3
import base64
import hashlib
import os
import socket
import ssl
import struct
import sys
import threading
import urllib.parse

def main():
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: tiwlo-ssh-v1.py <wss://... | ws://...>\\n")
        sys.exit(2)
    u = urllib.parse.urlparse(sys.argv[1])
    is_tls = u.scheme == "wss"
    host = u.hostname
    port = u.port or (443 if is_tls else 80)
    path = (u.path or "/") + (f"?{u.query}" if u.query else "")
    host_header = f"{host}:{port}" if u.port else host

    raw = socket.create_connection((host, port), timeout=15)
    raw.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    if is_tls:
        ctx = ssl.create_default_context()
        sock = ctx.wrap_socket(raw, server_hostname=host)
    else:
        sock = raw
    sock.settimeout(None)

    key = base64.b64encode(os.urandom(16)).decode("ascii")
    req = (
        f"GET {path} HTTP/1.1\\r\\n"
        f"Host: {host_header}\\r\\n"
        f"Upgrade: websocket\\r\\n"
        f"Connection: Upgrade\\r\\n"
        f"Sec-WebSocket-Key: {key}\\r\\n"
        f"Sec-WebSocket-Version: 13\\r\\n"
        f"User-Agent: tiwlo-ssh-relay/1.0\\r\\n\\r\\n"
    ).encode("ascii")
    sock.sendall(req)

    buf = bytearray()
    while b"\\r\\n\\r\\n" not in buf:
        chunk = sock.recv(4096)
        if not chunk:
            raise RuntimeError("WebSocket handshake closed by server")
        buf.extend(chunk)
        if len(buf) > 32768:
            raise RuntimeError("WebSocket handshake headers too large")

    hdr_end = buf.index(b"\\r\\n\\r\\n")
    hdr_text = bytes(buf[:hdr_end]).decode("latin1")
    del buf[: hdr_end + 4]
    status_line = hdr_text.split("\\r\\n", 1)[0]
    if " 101 " not in status_line:
        raise RuntimeError(f"WebSocket upgrade rejected: {status_line}")

    expected_accept = base64.b64encode(
        hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode("ascii")).digest()
    ).decode("ascii")
    accept_ok = False
    for line in hdr_text.split("\\r\\n")[1:]:
        if ":" in line:
            k, v = line.split(":", 1)
            if k.strip().lower() == "sec-websocket-accept" and v.strip() == expected_accept:
                accept_ok = True
                break
    if not accept_ok:
        raise RuntimeError("Invalid Sec-WebSocket-Accept from server")

    send_lock = threading.Lock()
    stop_event = threading.Event()

    def send_frame(opcode, data=b""):
        mask = os.urandom(4)
        length = len(data)
        header = bytearray([0x80 | opcode])
        if length < 126:
            header.append(0x80 | length)
        elif length < 65536:
            header.append(0x80 | 126)
            header.extend(struct.pack("!H", length))
        else:
            header.append(0x80 | 127)
            header.extend(struct.pack("!Q", length))
        header.extend(mask)
        masked = bytes(b ^ mask[i & 3] for i, b in enumerate(data))
        with send_lock:
            sock.sendall(bytes(header) + masked)

    def read_exact(n):
        while len(buf) < n:
            chunk = sock.recv(max(4096, n - len(buf)))
            if not chunk:
                return None
            buf.extend(chunk)
        out = bytes(buf[:n])
        del buf[:n]
        return out

    def write_all(fd, data):
        view = memoryview(data)
        sent = 0
        while sent < len(view):
            sent += os.write(fd, view[sent:])

    def rx_loop():
        try:
            while not stop_event.is_set():
                h = read_exact(2)
                if not h:
                    break
                b1, b2 = h[0], h[1]
                opcode = b1 & 0x0F
                masked = (b2 & 0x80) != 0
                length = b2 & 0x7F
                if length == 126:
                    ext = read_exact(2)
                    if not ext:
                        break
                    length = struct.unpack("!H", ext)[0]
                elif length == 127:
                    ext = read_exact(8)
                    if not ext:
                        break
                    length = struct.unpack("!Q", ext)[0]
                mask_key = read_exact(4) if masked else None
                if masked and not mask_key:
                    break
                payload = read_exact(length) if length > 0 else b""
                if length > 0 and payload is None:
                    break
                if masked and payload:
                    payload = bytes(b ^ mask_key[i & 3] for i, b in enumerate(payload))
                if opcode == 0x8:
                    break
                if opcode == 0x9:
                    try:
                        send_frame(0xA, payload)
                    except OSError:
                        break
                elif opcode in (0x0, 0x1, 0x2) and payload:
                    write_all(1, payload)
        except OSError:
            pass
        finally:
            stop_event.set()
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass

    rx = threading.Thread(target=rx_loop, daemon=True)
    rx.start()

    try:
        while not stop_event.is_set():
            data = os.read(0, 65536)
            if not data:
                break
            send_frame(0x2, data)
    except OSError:
        pass
    finally:
        try:
            send_frame(0x8, b"")
        except OSError:
            pass
        stop_event.set()
        try:
            sock.close()
        except OSError:
            pass
        rx.join(timeout=1.0)

if __name__ == "__main__":
    main()
`;

export function buildSshRelayMetadata({
  dropletId = null,
  gatewayUser = null,
  hostname = null,
  domain = null
} = {}) {
  const cleanId = String(dropletId || '').trim();
  const cleanUser = String(gatewayUser || '').trim();
  if (!cleanId || !cleanUser) return null;

  const publicDomain = resolvePublicSshDomain(domain);
  const alias = String(hostname || cleanId)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/^-+|-+$/g, '') || cleanId;

  const encodedId = encodeURIComponent(cleanId);
  const sshBridgeUrl = `wss://${publicDomain}/ssh/${encodedId}`;
  const sshPortalUrl = `https://${publicDomain}/ssh/${encodedId}`;
  const webConsoleUrl = `https://${publicDomain}/cloud/droplets/${encodedId}/console`;

  const windowsProxyCommand =
    `powershell.exe -NoP -EP Bypass -c if(!(Test-Path ([Environment]::GetFolderPath(28)+'\\\\tiwlo-ssh-${WINDOWS_RELAY_SCRIPT_VERSION}.ps1'))){curl.exe -fsSL -o ([Environment]::GetFolderPath(28)+'\\\\tiwlo-ssh-${WINDOWS_RELAY_SCRIPT_VERSION}.ps1') https://${publicDomain}/ssh/relay-${WINDOWS_RELAY_SCRIPT_VERSION}.ps1}; & ([Environment]::GetFolderPath(28)+'\\\\tiwlo-ssh-${WINDOWS_RELAY_SCRIPT_VERSION}.ps1') ${sshBridgeUrl}`;

  const unixProxyCommand =
    `sh -c '[ -s ~/.ssh/tiwlo-ssh-${UNIX_RELAY_SCRIPT_VERSION}.py ] || (mkdir -p ~/.ssh && curl -fsSL -o ~/.ssh/tiwlo-ssh-${UNIX_RELAY_SCRIPT_VERSION}.py https://${publicDomain}/ssh/relay-${UNIX_RELAY_SCRIPT_VERSION}.py); exec python3 ~/.ssh/tiwlo-ssh-${UNIX_RELAY_SCRIPT_VERSION}.py ${sshBridgeUrl}'`;

  const windowsCommand = `ssh -o ServerAliveInterval=30 -o "ProxyCommand=${windowsProxyCommand}" ${cleanUser}@${publicDomain}`;
  const unixCommand = `ssh -o ServerAliveInterval=30 -o "ProxyCommand=${unixProxyCommand}" ${cleanUser}@${publicDomain}`;

  return {
    domain: publicDomain,
    endpointPath: `/ssh/${encodedId}`,
    sshPortalUrl,
    sshBridgeUrl,
    webConsoleUrl,
    gatewayUser: cleanUser,
    accessUser: 'root',
    windowsProxyCommand,
    unixProxyCommand,
    windowsCommand,
    unixCommand,
    sshConfigWindows: [
      `Host ${alias}`,
      `  HostName ${publicDomain}`,
      `  User ${cleanUser}`,
      `  ServerAliveInterval 30`,
      `  ProxyCommand ${windowsProxyCommand}`
    ].join('\n'),
    sshConfigUnix: [
      `Host ${alias}`,
      `  HostName ${publicDomain}`,
      `  User ${cleanUser}`,
      `  ServerAliveInterval 30`,
      `  ProxyCommand ${unixProxyCommand}`
    ].join('\n')
  };
}
