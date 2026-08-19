import { spawn } from "child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import path from "path";

const RUNTIME_DIR = path.join(process.cwd(), ".data");
const RUNTIME_URL_FILE = path.join(RUNTIME_DIR, "public-url.txt");
const ENV_PATH = path.join(process.cwd(), ".env");
const TUNNEL_LOG =
  process.platform === "win32"
    ? path.join(process.env.TEMP || process.cwd(), "ar-tunnel-repair-log.txt")
    : "/tmp/ar-tunnel-repair-log.txt";

export type TunnelStatus = {
  ok: boolean;
  severity: "ok" | "warn" | "error";
  configuredUrl: string;
  reachable: boolean;
  originReachable: boolean;
  isTryCloudflare: boolean;
  isLocalhost: boolean;
  title: string;
  detail: string;
  steps: string[];
  checkedAt: string;
};

function normalizeBase(url: string) {
  return url.replace(/\/$/, "");
}

function isDeadPublicUrl(url: string) {
  const u = url.toLowerCase();
  return (
    !u ||
    u.includes("localhost") ||
    u.includes("127.0.0.1") ||
    u.includes("trycloudflare.com")
  );
}

function vercelProductionUrl() {
  const prod = process.env["VERCEL_PROJECT_PRODUCTION_URL"];
  if (prod) {
    return normalizeBase(
      prod.startsWith("http") ? prod : `https://${prod}`,
    );
  }
  const preview = process.env["VERCEL_URL"];
  if (preview) {
    return normalizeBase(
      preview.startsWith("http") ? preview : `https://${preview}`,
    );
  }
  return "";
}

/** QR / OG için canlı public URL */
export function getPublicAppUrl(): string {
  const fromEnv = process.env["NEXT_PUBLIC_APP_URL"] || "";

  if (process.env["VERCEL"]) {
    if (fromEnv && !isDeadPublicUrl(fromEnv)) {
      return normalizeBase(fromEnv);
    }
    const vercel = vercelProductionUrl();
    if (vercel) return vercel;
  }

  try {
    if (existsSync(RUNTIME_URL_FILE)) {
      const raw = readFileSync(RUNTIME_URL_FILE, "utf8").trim();
      if (raw && !(process.env["VERCEL"] && isDeadPublicUrl(raw))) {
        return normalizeBase(raw);
      }
    }
  } catch {
    // ignore
  }
  return normalizeBase(fromEnv || "http://localhost:3000");
}

export function writePublicAppUrl(url: string) {
  const clean = normalizeBase(url);
  if (!existsSync(RUNTIME_DIR)) mkdirSync(RUNTIME_DIR, { recursive: true });
  writeFileSync(RUNTIME_URL_FILE, clean, "utf8");
  // NEXT_PUBLIC_* atama YASAK — Next DefinePlugin string'e çevirir → SyntaxError
  updateEnvFile(clean);
  return clean;
}

function updateEnvFile(url: string) {
  let content = "";
  try {
    content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  } catch {
    content = "";
  }
  const line = `NEXT_PUBLIC_APP_URL=${url}`;
  if (/NEXT_PUBLIC_APP_URL=.*/.test(content)) {
    content = content.replace(/NEXT_PUBLIC_APP_URL=.*/g, line);
  } else {
    content = content.trimEnd()
      ? `${content.trimEnd()}\n${line}\n`
      : `${line}\n`;
  }
  writeFileSync(ENV_PATH, content, "utf8");
}

async function probeUrl(url: string): Promise<{
  reachable: boolean;
  reason?: string;
}> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      cache: "no-store",
      headers: { Accept: "text/html,*/*" },
    });
    clearTimeout(timer);
    const text = (await res.text().catch(() => "")).slice(0, 4000);
    if (
      text.includes("Error 1033") ||
      text.includes("error code: 1033") ||
      text.includes("Cloudflare Tunnel error")
    ) {
      return { reachable: false, reason: "Cloudflare Error 1033 (tunnel kapalı)" };
    }
    if (res.status >= 500) {
      return { reachable: false, reason: `HTTP ${res.status}` };
    }
    // Origin cevap veriyor (200/401/404 yeterli)
    return { reachable: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "bağlantı yok";
    return { reachable: false, reason: msg.includes("abort") ? "zaman aşımı" : msg };
  }
}

export async function getTunnelStatus(opts?: {
  /** Tarayıcının şu an açık olduğu host (ör. çalışan trycloudflare) */
  liveHost?: string | null;
}): Promise<TunnelStatus> {
  let configuredUrl = getPublicAppUrl();
  const liveHost = (opts?.liveHost || "").replace(/\/$/, "").toLowerCase();
  const liveOrigin =
    liveHost && !liveHost.startsWith("http")
      ? `https://${liveHost}`
      : liveHost;

  // Kullanıcı çalışan bir trycloudflare ile girdiyse kayıtlı ölü URL'yi güncelle.
  // İstek bu host üzerinden geldiyse probe şart değil (zaten erişiyor).
  if (
    liveOrigin.includes("trycloudflare.com") &&
    normalizeBase(liveOrigin) !== normalizeBase(configuredUrl)
  ) {
    configuredUrl = writePublicAppUrl(normalizeBase(liveOrigin));
  }

  const isLocalhost = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?/i.test(
    configuredUrl,
  );
  const isTryCloudflare = configuredUrl.includes("trycloudflare.com");

  const origin = await probeUrl("http://127.0.0.1:3000");
  const remote = isLocalhost
    ? { reachable: origin.reachable, reason: origin.reason }
    : await probeUrl(configuredUrl);

  const checkedAt = new Date().toISOString();

  // Canlı host zaten bu sayfayı sunuyorsa — uzak probe flaky olsa bile OK say
  if (
    liveOrigin.includes("trycloudflare.com") &&
    normalizeBase(liveOrigin) === normalizeBase(configuredUrl) &&
    origin.reachable
  ) {
    return {
      ok: true,
      severity: "ok",
      configuredUrl,
      reachable: true,
      originReachable: true,
      isTryCloudflare: true,
      isLocalhost: false,
      title: "Tunnel sağlıklı",
      detail: `Sayfa çalışan tunnel üzerinden açık: ${configuredUrl}`,
      steps: [],
      checkedAt,
    };
  }

  if (!origin.reachable) {
    return {
      ok: false,
      severity: "error",
      configuredUrl,
      reachable: false,
      originReachable: false,
      isTryCloudflare,
      isLocalhost,
      title: "Yerel sunucu kapalı",
      detail:
        "localhost:3000 yanıt vermiyor. Tunnel düzeltmeden önce Next.js (`npm run dev` / baslat.bat) çalışmalı.",
      steps: [
        "Bilgisayarda `baslat.bat` veya `npm run dev` çalıştırın",
        "Sonra bu pencerede «Otomatik düzelt»e basın",
      ],
      checkedAt,
    };
  }

  if (isLocalhost) {
    return {
      ok: true,
      severity: "warn",
      configuredUrl,
      reachable: true,
      originReachable: true,
      isTryCloudflare: false,
      isLocalhost: true,
      title: "Tunnel yok (localhost)",
      detail:
        "QR hâlâ localhost. Telefonda açmak için Cloudflare tunnel gerekir.",
      steps: [
        "«Otomatik düzelt» ile tunnel başlatın",
        "Admin’de QR’ı yenileyin",
      ],
      checkedAt,
    };
  }

  if (!remote.reachable) {
    return {
      ok: false,
      severity: "error",
      configuredUrl,
      reachable: false,
      originReachable: true,
      isTryCloudflare,
      isLocalhost: false,
      title: "Tunnel koptu — telefon / QR çalışmaz",
      detail: `Kayıtlı adres yanıt vermiyor${remote.reason ? ` (${remote.reason})` : ""}. Eski trycloudflare linki ölü; QR ve WhatsApp paylaşımı kırılır.`,
      steps: [
        "«Otomatik düzelt» — yeni tunnel açılır, .env güncellenir",
        "Admin → Katalog/Kampanya → QR yeniden derle / yenile",
        "Eski telefon linkini atın; yeni adresi kullanın",
      ],
      checkedAt,
    };
  }

  return {
    ok: true,
    severity: "ok",
    configuredUrl,
    reachable: true,
    originReachable: true,
    isTryCloudflare,
    isLocalhost: false,
    title: "Tunnel sağlıklı",
    detail: `Public URL erişilebilir: ${configuredUrl}`,
    steps: [],
    checkedAt,
  };
}

function killCloudflared(): Promise<void> {
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      const p = spawn("taskkill", ["/IM", "cloudflared.exe", "/F"], {
        shell: true,
        windowsHide: true,
      });
      p.on("close", () => resolve());
      p.on("error", () => resolve());
    } else {
      const p = spawn("pkill", ["-f", "cloudflared"], { shell: true });
      p.on("close", () => resolve());
      p.on("error", () => resolve());
    }
  });
}

function extractTunnelUrl(text: string): string | null {
  const m = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  return m ? m[0] : null;
}

function readTunnelLog(): string {
  try {
    if (!existsSync(TUNNEL_LOG)) return "";
    const buf = readFileSync(TUNNEL_LOG);
    if (buf.length === 0) return "";
    // PowerShell Tee-Object çoğu zaman UTF-16 LE yazar
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
      return buf.toString("utf16le");
    }
    let nulls = 0;
    for (let i = 0; i < Math.min(buf.length, 200); i++) {
      if (buf[i] === 0) nulls++;
    }
    if (nulls > 20) return buf.toString("utf16le");
    return buf.toString("utf8");
  } catch {
    return "";
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function npxCommand(): string {
  if (process.platform === "win32") {
    const base = process.env.ProgramFiles || "C:\\Program Files";
    const candidate = path.join(base, "nodejs", "npx.cmd");
    if (existsSync(candidate)) return `"${candidate}"`;
    return "npx.cmd";
  }
  return "npx";
}

export async function repairTunnel(): Promise<{
  ok: boolean;
  url?: string;
  error?: string;
  logTail?: string;
}> {
  const origin = await probeUrl("http://127.0.0.1:3000");
  if (!origin.reachable) {
    return {
      ok: false,
      error:
        "localhost:3000 kapalı. Önce Next.js’i başlatın, sonra tekrar deneyin.",
    };
  }

  await killCloudflared();
  await sleep(1200);

  try {
    if (existsSync(TUNNEL_LOG)) unlinkSync(TUNNEL_LOG);
  } catch {
    // ignore
  }

  if (!existsSync(RUNTIME_DIR)) mkdirSync(RUNTIME_DIR, { recursive: true });

  const batPath = path.join(RUNTIME_DIR, "start-tunnel.bat");
  const npx = npxCommand();
  const bat = [
    "@echo off",
    `cd /d "${process.cwd()}"`,
    `${npx} --yes cloudflared tunnel --url http://127.0.0.1:3000 > "${TUNNEL_LOG}" 2>&1`,
    "",
  ].join("\r\n");
  writeFileSync(batPath, bat, "utf8");

  let spawnError = "";
  // `start /b` — Next process ağacından bağımsız başlatır (stdio kopması olmaz)
  const child = spawn("cmd.exe", ["/c", "start", "/b", "", batPath], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    shell: false,
    env: process.env,
  });
  child.on("error", (e) => {
    spawnError = e.message;
  });
  child.unref();

  await sleep(2500);

  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (spawnError) {
      return {
        ok: false,
        error: `Tunnel süreci başlatılamadı: ${spawnError}`,
      };
    }
    const text = readTunnelLog();
    const url = extractTunnelUrl(text);
    if (url) {
      writePublicAppUrl(url);
      // trycloudflare DNS yayılımı için bekle
      let reachable = false;
      for (let i = 0; i < 12; i++) {
        await sleep(1500);
        const probe = await probeUrl(url);
        if (probe.reachable) {
          reachable = true;
          break;
        }
      }
      if (!reachable) {
        return {
          ok: true,
          url,
          error:
            "Yeni URL alındı ama henüz hazır olmayabilir; birkaç saniye bekleyip QR yenileyin.",
          logTail: text.slice(-800),
        };
      }
      return { ok: true, url, logTail: text.slice(-400) };
    }
    await sleep(700);
  }

  const tail = readTunnelLog().slice(-1200);
  return {
    ok: false,
    error:
      "60 sn içinde tunnel URL alınamadı. cloudflared / ağ engeli olabilir. İsterseniz tunnel.bat’i manuel açın.",
    logTail: tail || "(log boş — cloudflared başlamamış olabilir)",
  };
}
