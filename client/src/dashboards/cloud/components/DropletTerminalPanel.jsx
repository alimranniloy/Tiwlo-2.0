import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Power, RefreshCw, Terminal, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/shadcnPrimitives';

function getAuthHeaders(extra = {}) {
  let token = '';
  try {
    token = localStorage.getItem('stockpro_session') || sessionStorage.getItem('stockpro_session') || '';
  } catch {}
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export default function DropletTerminalPanel({
  dropletId,
  dropletName,
  sshCommand,
  isRunning,
  isSuspended,
}) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const wsRef = useRef(null);
  const [connState, setConnState] = useState(isRunning ? 'connecting' : 'stopped');
  const [statusNote, setStatusNote] = useState('');
  const [reconnectTick, setReconnectTick] = useState(0);

  const connect = useCallback(async () => {
    if (!dropletId || !isRunning || isSuspended || !containerRef.current) {
      setConnState(isSuspended ? 'suspended' : 'stopped');
      return;
    }

    setConnState('connecting');
    setStatusNote('');

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    if (!termRef.current) {
      const term = new XTerm({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
        scrollback: 5000,
        theme: {
          background: '#0a0a0a',
          foreground: '#f5f5f5',
          cursor: '#1ED760',
          selectionBackground: 'rgba(30, 215, 96, 0.25)',
        },
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);
      try {
        fitAddon.fit();
      } catch {}
      termRef.current = term;
      fitAddonRef.current = fitAddon;
    } else {
      try {
        fitAddonRef.current?.fit();
      } catch {}
    }

    const term = termRef.current;
    const cols = Math.max(40, term?.cols || 100);
    const rows = Math.max(12, term?.rows || 28);

    try {
      const res = await fetch(`/api/cloud/droplets/${encodeURIComponent(dropletId)}/terminal-ticket`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ticket) {
        setConnState('error');
        setStatusNote(json?.error || `Unable to open terminal (HTTP ${res.status})`);
        term.writeln(`\r\n\x1b[31m[Connection blocked] ${json?.error || 'Could not authorize WebSocket session'}\x1b[0m`);
        return;
      }

      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProto}//${window.location.host}/api/cloud/droplets/${encodeURIComponent(dropletId)}/terminal?ticket=${encodeURIComponent(json.ticket)}&cols=${cols}&rows=${rows}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnState('connected');
        setStatusNote('Connected over HTTPS (Port 443 WebSocket Tunnel)');
        term.focus();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'output' && typeof msg.data === 'string') {
            term.write(msg.data);
          } else if (msg.type === 'exit') {
            setConnState('disconnected');
            setStatusNote(`Shell exited (code ${msg.code ?? 0})`);
            term.writeln(`\r\n\x1b[33m[Shell exited with code ${msg.code ?? 0}]\x1b[0m`);
          }
        } catch {
          if (typeof event.data === 'string') term.write(event.data);
        }
      };

      ws.onerror = () => {
        setConnState('error');
        setStatusNote('WebSocket terminal stream interrupted.');
      };

      ws.onclose = (ev) => {
        setConnState((prev) => (prev === 'error' ? prev : 'disconnected'));
        if (ev?.reason) setStatusNote(ev.reason);
      };

      const dataDisp = term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'input', data }));
        }
      });

      return () => {
        dataDisp?.dispose();
      };
    } catch (err) {
      setConnState('error');
      setStatusNote(err?.message || 'Failed to connect browser SSH console');
    }
  }, [dropletId, isRunning, isSuspended]);

  useEffect(() => {
    let cleanupData;
    let active = true;
    connect().then((fn) => {
      if (active) cleanupData = fn;
    });
    return () => {
      active = false;
      if (typeof cleanupData === 'function') cleanupData();
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }
    };
  }, [connect, reconnectTick]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const handleResize = () => {
      try {
        fitAddonRef.current?.fit();
        const term = termRef.current;
        if (wsRef.current?.readyState === WebSocket.OPEN && term) {
          wsRef.current.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        }
      } catch {}
    };
    const obs = new ResizeObserver(handleResize);
    obs.observe(containerRef.current);
    window.addEventListener('resize', handleResize);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    return () => {
      try {
        termRef.current?.dispose();
      } catch {}
      termRef.current = null;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="size-4 text-[#1ED760]" aria-hidden="true" />
              Interactive Browser SSH Console
              <Badge
                variant={
                  connState === 'connected'
                    ? 'success'
                    : connState === 'connecting'
                      ? 'brand'
                      : 'warning'
                }
                className="capitalize"
              >
                {connState}
              </Badge>
            </CardTitle>
            <CardDescription>
              Direct HTTPS/WSS Port 443 Ubuntu shell into <strong>{dropletName || dropletId}</strong> — works from IPv4 and IPv6 browsers with zero extra router ports.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => termRef.current?.clear()}
              disabled={!termRef.current}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Clear
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={() => setReconnectTick((t) => t + 1)}
              disabled={!isRunning || isSuspended}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Reconnect
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {!isRunning ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center dark:border-neutral-800 dark:bg-neutral-900/50">
            <Power className="mb-3 size-7 text-amber-500" />
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">
              {isSuspended ? 'Instance is suspended' : 'VPS is currently powered off'}
            </p>
            <p className="mt-1 max-w-md text-xs text-neutral-500 dark:text-neutral-400">
              {isSuspended
                ? 'Top up credits or clear the account hold to resume this Ubuntu container.'
                : 'Click "Power On" in the header above to start this container and open an interactive terminal.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-[#0a0a0a] p-3 shadow-inner">
              <div ref={containerRef} className="h-[440px] w-full" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
              <span>{statusNote || 'Tip: Right-click or use Ctrl+Shift+V / Ctrl+Shift+C to paste or copy inside terminal.'}</span>
              {sshCommand && (
                <span className="font-mono text-neutral-600 dark:text-neutral-300">
                  Native CLI: {sshCommand}
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
