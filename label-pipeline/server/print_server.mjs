// Local label-print bridge. The admin pages (a browser) can't talk to a USB printer or to WSL, so
// this tiny server runs on the shop PC next to the Brother QL-800 and the admin's
// "ラベルを一式印刷" button calls it at http://127.0.0.1:8765.
//
//   GET  /status  -> is the printer plugged in AND reachable from WSL? (auto-attaches if it can)
//   POST /print   -> { orders: [{ orderNumber, items: [..], hasGlow }], includeLogo, includeInsert }
//                    prints, per order: contents label, then (optionally) brand logo + thank-you.
//
// Start it with label-pipeline\start_print_server.bat (leave the window open while working).
// No dependencies -- plain node. Arguments are passed to WSL with --exec (no shell), so order text
// can never be interpreted as a command.
import { execFile, spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.LC_PRINT_PORT ?? 8765);
const DISTRO = process.env.LC_WSL_DISTRO ?? "Ubuntu";
const PRINTER_ID = "04f9:209b"; // Brother QL-800
const BROTHER_URI = "usb://0x04f9:0x209b";
const ALLOWED_ORIGINS = new Set(
  [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    ...(process.env.LC_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  ]
);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.resolve(HERE, "..", "scripts");
const OUTPUT_DIR = path.resolve(HERE, "..", "output");

// C:\a\b -> /mnt/c/a/b, as seen from inside WSL
function toWslPath(winPath) {
  const m = /^([A-Za-z]):\\(.*)$/.exec(winPath);
  if (!m) throw new Error(`Not a drive path: ${winPath}`);
  return `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, "/")}`;
}
const WSL_SCRIPTS = toWslPath(SCRIPTS_DIR);
const WSL_OUTPUT = toWslPath(OUTPUT_DIR);

function run(file, args, timeoutMs = 60000) {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: timeoutMs, windowsHide: true, encoding: "utf8" }, (error, stdout, stderr) => {
      resolve({ ok: !error, stdout: String(stdout ?? ""), stderr: String(stderr ?? ""), error });
    });
  });
}
const wsl = (args, timeoutMs) => run("wsl", ["-d", DISTRO, "--exec", ...args], timeoutMs);

let keepAlive = null;
function ensureWslRunning() {
  // The USB attach only survives while some WSL process keeps the VM alive.
  if (keepAlive && keepAlive.exitCode === null) return;
  keepAlive = spawn("wsl", ["-d", DISTRO, "--exec", "sleep", "86400"], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  keepAlive.unref();
}

async function printerStatus() {
  ensureWslRunning();
  const list = await run("usbipd", ["list"]);
  if (!list.ok && !list.stdout) {
    return { state: "usbipd_missing", message: "usbipd が見つかりません（USBをWSLに渡すツールが未インストール）" };
  }
  const line = list.stdout.split(/\r?\n/).find((l) => l.includes(PRINTER_ID));
  if (!line) {
    return { state: "not_found", message: "プリンター(QL-800)がPCに接続されていません。USBケーブルと電源を確認してください" };
  }
  const busId = /^\s*(\d+-\d+)/.exec(line)?.[1];
  if (/Not shared/i.test(line)) {
    return { state: "needs_bind", message: `初回のみ管理者のPowerShellで usbipd bind --busid ${busId} が必要です` };
  }

  const inWsl = async () => (await wsl(["lsusb"])).stdout.toLowerCase().includes(PRINTER_ID);
  if (await inWsl()) return { state: "ready", message: "印刷できます" };

  if (busId) {
    await run("usbipd", ["attach", "--wsl", "--busid", busId]);
    await new Promise((r) => setTimeout(r, 3000));
    if (await inWsl()) return { state: "ready", message: "印刷できます（プリンターを自動で再接続しました）" };
  }
  return { state: "attach_failed", message: "プリンターをWSLに接続できませんでした。USBを抜き差ししてもう一度お試しください" };
}

async function printImage(file) {
  const res = await wsl([
    "brother_ql", "-b", "pyusb", "--model", "QL-800", "-p", BROTHER_URI, "print", "-l", "62", `${WSL_OUTPUT}/${file}`,
  ]);
  const text = res.stdout + res.stderr;
  if (!res.ok || !/Printing was successful/i.test(text)) {
    throw new Error(`印刷に失敗しました (${file}): ${text.split("\n").filter((l) => !/deprecat/i.test(l)).slice(-3).join(" ").trim()}`);
  }
}

async function generate(script, args = []) {
  const res = await wsl(["python3", `${WSL_SCRIPTS}/${script}`, ...args]);
  if (!res.ok) throw new Error(`ラベル画像の作成に失敗しました (${script}): ${(res.stderr || res.stdout).trim().slice(-200)}`);
}

// One print at a time -- every label is written to the same output/*.png filenames.
let queue = Promise.resolve();
function enqueue(job) {
  const next = queue.then(job, job);
  queue = next.catch(() => {});
  return next;
}

function validate(body) {
  const orders = body?.orders;
  if (!Array.isArray(orders) || orders.length === 0 || orders.length > 40) throw new Error("orders が不正です");
  return orders.map((o) => {
    const orderNumber = typeof o?.orderNumber === "string" ? o.orderNumber.trim() : "";
    const items = Array.isArray(o?.items) ? o.items : [];
    if (!orderNumber || orderNumber.length > 60) throw new Error("注文番号が不正です");
    if (items.length === 0 || items.length > 30) throw new Error("内容物が不正です");
    if (!items.every((s) => typeof s === "string" && s.length > 0 && s.length <= 400)) throw new Error("内容物が不正です");
    return { orderNumber, items, hasGlow: o?.hasGlow === true };
  });
}

async function handlePrint(body) {
  const orders = validate(body);
  const includeLogo = body?.includeLogo !== false;
  const includeInsert = body?.includeInsert !== false;

  const status = await printerStatus();
  if (status.state !== "ready") throw new Error(status.message);

  const printed = [];
  for (const order of orders) {
    await generate("make_contents_label.py", [order.orderNumber, ...order.items]);
    await printImage("contents_label.png");
    if (includeLogo) {
      await generate("make_logo_label.py");
      await printImage("logo_label.png");
    }
    if (includeInsert) {
      // The glow-in-the-dark care note only goes on the thank-you for orders with a glow color.
      await generate("make_insert_label.py", order.hasGlow ? ["--glow"] : []);
      await printImage("insert_label.png");
    }
    printed.push(order.orderNumber);
  }
  return { printed };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 200_000) {
        reject(new Error("too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("invalid json"));
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const allowed = origin && ALLOWED_ORIGINS.has(origin);
  if (allowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    // Chrome asks for this when a public https page (the deployed admin) calls localhost.
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  const send = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(obj));
  };

  if (req.method === "OPTIONS") {
    res.writeHead(allowed ? 204 : 403);
    return res.end();
  }
  // Requests with no Origin (curl/PowerShell on this PC) are fine; a browser page from any other
  // site is refused so a random website can't make this printer print.
  if (origin && !allowed) return send(403, { error: "origin not allowed" });

  try {
    if (req.method === "GET" && req.url === "/status") {
      return send(200, { server: true, ...(await printerStatus()) });
    }
    if (req.method === "POST" && req.url === "/print") {
      const result = await enqueue(async () => handlePrint(await readBody(req)));
      return send(200, { ok: true, ...result });
    }
    return send(404, { error: "not found" });
  } catch (err) {
    return send(500, { ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`label print server: http://127.0.0.1:${PORT}  (allowed origins: ${[...ALLOWED_ORIGINS].join(", ")})`);
  ensureWslRunning();
});
