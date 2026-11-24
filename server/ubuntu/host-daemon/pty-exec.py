#!/usr/bin/env python3
"""
Lightweight Python 3 stdlib PTY bridge between tiwlo-vps-daemon (Node.js)
and `docker exec -it <container> /bin/bash -l` using line-delimited base64 JSON frames.
"""
import base64
import fcntl
import json
import os
import pty
import re
import select
import signal
import struct
import sys
import termios

CONTAINER_RE = re.compile(r"^tiwlo-vps-[a-zA-Z0-9_-]{4,64}$")
USER_RE = re.compile(r"^[a-z_][a-z0-9_-]{0,31}$")


def emit(obj):
    sys.stdout.write(json.dumps(obj, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def set_winsize(fd, cols, rows):
    c = max(20, min(500, int(cols or 120)))
    r = max(5, min(200, int(rows or 32)))
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", r, c, 0, 0))


def main():
    if len(sys.argv) < 3:
        sys.stderr.write("Usage: pty-exec.py <container> <username> [cols] [rows]\n")
        sys.exit(2)

    container = sys.argv[1].strip()
    username = sys.argv[2].strip()
    cols = int(sys.argv[3]) if len(sys.argv) > 3 else 120
    rows = int(sys.argv[4]) if len(sys.argv) > 4 else 32

    if not CONTAINER_RE.match(container):
        sys.stderr.write("Invalid container name\n")
        sys.exit(2)
    if not USER_RE.match(username):
        sys.stderr.write("Invalid username\n")
        sys.exit(2)

    pid, master_fd = pty.fork()
    if pid == 0:
        os.environ["TERM"] = "xterm-256color"
        os.execvp(
            "docker",
            [
                "docker",
                "exec",
                "-it",
                "-e",
                "TERM=xterm-256color",
                "-u",
                username,
                container,
                "/bin/bash",
                "-l",
            ],
        )
        os._exit(127)

    try:
        set_winsize(master_fd, cols, rows)
    except Exception:
        pass

    os.set_blocking(master_fd, False)
    stdin_fd = sys.stdin.fileno()
    os.set_blocking(stdin_fd, False)
    stdin_buf = b""
    child_exited = False
    exit_code = 0

    try:
        while not child_exited:
            rlist, _, _ = select.select([master_fd, stdin_fd], [], [], 0.25)

            if master_fd in rlist:
                try:
                    data = os.read(master_fd, 16384)
                    if data:
                        emit({"t": "o", "d": base64.b64encode(data).decode("ascii")})
                    else:
                        break
                except OSError:
                    break

            if stdin_fd in rlist:
                try:
                    chunk = os.read(stdin_fd, 16384)
                except BlockingIOError:
                    chunk = b""
                if chunk == b"":
                    break
                stdin_buf += chunk
                while b"\n" in stdin_buf:
                    line, stdin_buf = stdin_buf.split(b"\n", 1)
                    if not line.strip():
                        continue
                    try:
                        msg = json.loads(line.decode("utf-8"))
                    except Exception:
                        continue
                    msg_type = msg.get("t")
                    if msg_type == "i" and isinstance(msg.get("d"), str):
                        try:
                            raw_in = base64.b64decode(msg["d"])
                            if raw_in:
                                os.write(master_fd, raw_in)
                        except Exception:
                            pass
                    elif msg_type == "r":
                        try:
                            set_winsize(master_fd, msg.get("c", 120), msg.get("r2", 32))
                            os.kill(pid, signal.SIGWINCH)
                        except Exception:
                            pass
                    elif msg_type == "k":
                        try:
                            os.kill(pid, signal.SIGTERM)
                        except Exception:
                            pass
                        child_exited = True
                        break

            waited_pid, status = os.waitpid(pid, os.WNOHANG)
            if waited_pid == pid:
                if os.WIFEXITED(status):
                    exit_code = os.WEXITSTATUS(status)
                elif os.WIFSIGNALED(status):
                    exit_code = 128 + os.WTERMSIG(status)
                # Flush remaining PTY bytes before exit
                for _ in range(10):
                    try:
                        tail = os.read(master_fd, 16384)
                        if not tail:
                            break
                        emit({"t": "o", "d": base64.b64encode(tail).decode("ascii")})
                    except Exception:
                        break
                child_exited = True
                break
    finally:
        try:
            os.close(master_fd)
        except Exception:
            pass
        try:
            os.waitpid(pid, os.WNOHANG)
        except Exception:
            pass
        emit({"t": "e", "code": exit_code})


if __name__ == "__main__":
    main()
