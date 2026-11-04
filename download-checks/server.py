# Copyright 2026 Yandex LLC. All rights reserved.
"""Serve deterministic download fixtures using only the Python standard library."""

import argparse
import hashlib
import json
import re
import threading
import time
import uuid
from datetime import datetime, timezone
from email.utils import formatdate
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent
EXPECTED_SIZE = 3667214
EXPECTED_SHA256 = "4c3d89f4130a6349bab2a6b9c57066879c95c87f966ca5ff4b8c689e4834184b"
CHUNK_SIZE = 8192
CHUNK_INTERVAL = 0.25
EVENTS = []
LOCK = threading.Lock()


def record(**event):
    row = {"time": datetime.now(timezone.utc).isoformat(), **event}
    with LOCK:
        EVENTS.append(row)
        with (ROOT / "server-events.jsonl").open("a", encoding="utf-8") as output:
            output.write(json.dumps(row, ensure_ascii=False) + "\n")


def byte_range(value, size):
    match = re.fullmatch(r"bytes=(\d*)-(\d*)", value)
    if not match or not any(match.groups()):
        raise ValueError("Unsupported Range")
    first, last = match.groups()
    if not first:
        count = int(last)
        if count <= 0:
            raise ValueError("Empty suffix")
        return max(0, size - count), size - 1
    start = int(first)
    end = min(int(last), size - 1) if last else size - 1
    if start >= size or end < start:
        raise ValueError("Unsatisfiable Range")
    return start, end


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format_string, *args):
        pass

    def do_HEAD(self):
        self.respond(head=True)

    def do_GET(self):
        self.respond(head=False)

    def send_bytes(self, data, content_type, head):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if not head:
            self.wfile.write(data)

    def respond(self, head):
        path = urlsplit(self.path).path
        if path in ("/", "/download-checks.html"):
            self.send_bytes((ROOT / "download-checks.html").read_bytes(), "text/html; charset=utf-8", head)
        elif path == "/download-checks.js":
            self.send_bytes((ROOT / "download-checks.js").read_bytes(), "text/javascript; charset=utf-8", head)
        elif path == "/status":
            with LOCK:
                events = list(EVENTS)
            body = json.dumps({"version": "1.0.0", "size": EXPECTED_SIZE,
                               "sha256": EXPECTED_SHA256, "events": events}).encode("utf-8")
            self.send_bytes(body, "application/json; charset=utf-8", head)
        elif path == "/slow.webm":
            self.download(head)
        else:
            self.send_error(404)

    def download(self, head):
        data = self.server.video
        size = len(data)
        etag = '"' + EXPECTED_SHA256 + '"'
        modified = self.server.modified
        requested_range = self.headers.get("Range")
        if_range = self.headers.get("If-Range")
        use_range = requested_range and (not if_range or if_range in (etag, modified))
        start, end = 0, size - 1
        if use_range:
            try:
                start, end = byte_range(requested_range, size)
            except ValueError:
                self.send_response(416)
                self.send_header("Content-Range", "bytes */" + str(size))
                self.send_header("Content-Length", "0")
                self.end_headers()
                return
        status = 206 if use_range else 200
        self.send_response(status)
        for name, value in {
            "Content-Type": "video/webm",
            "Content-Length": str(end - start + 1),
            "Content-Disposition": 'attachment; filename="risk5-pause-resume.webm"',
            "Accept-Ranges": "bytes", "ETag": etag, "Last-Modified": modified,
            "Cache-Control": "no-store",
        }.items():
            self.send_header(name, value)
        if use_range:
            self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.end_headers()
        if head:
            return
        request_id = uuid.uuid4().hex
        sent = 0
        record(event="download-start", id=request_id, start=start, end=end,
               range=requested_range, if_range=if_range, status=status)
        try:
            for position in range(start, end + 1, CHUNK_SIZE):
                time.sleep(CHUNK_INTERVAL)
                chunk = data[position:min(position + CHUNK_SIZE, end + 1)]
                self.wfile.write(chunk)
                self.wfile.flush()
                sent += len(chunk)
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            pass
        finally:
            record(event="download-end", id=request_id, start=start, sent=sent,
                   complete=sent == end - start + 1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8769)
    args = parser.parse_args()
    video_path = ROOT / "video.webm"
    video = video_path.read_bytes()
    digest = hashlib.sha256(video).hexdigest()
    if len(video) != EXPECTED_SIZE or digest != EXPECTED_SHA256:
        raise SystemExit("video.webm does not match the fixture size and SHA256")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.video = video
    server.modified = formatdate(video_path.stat().st_mtime, usegmt=True)
    record(event="server-ready", port=args.port, size=len(video), sha256=digest)
    print("Download Checks: http://localhost:%d/" % args.port, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
