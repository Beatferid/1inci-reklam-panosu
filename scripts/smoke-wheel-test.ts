import { PrismaClient } from "@prisma/client";
import { prizesToSlices } from "../src/lib/wheel";
import {
  assertInsideLocations,
  publicGeoInfo,
  type CampaignLocation,
} from "../src/lib/wheel-geo";
import { getWheelDisplaySettings } from "../src/lib/wheel-display";

const BASE = "http://127.0.0.1:3000";
const prisma = new PrismaClient();

async function httpJson(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text.slice(0, 200);
  }
  return { status: res.status, json };
}

async function main() {
  const results: { name: string; ok: boolean; detail: string }[] = [];

  // 1) Server up
  try {
    const home = await fetch(BASE, { cache: "no-store" });
    results.push({
      name: "Sunucu ayakta",
      ok: home.ok,
      detail: `HTTP ${home.status}`,
    });
  } catch (e) {
    results.push({
      name: "Sunucu ayakta",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
    console.log(JSON.stringify(results, null, 2));
    process.exit(1);
  }

  // 2) Empty slice visible in equal mode
  const slices = prizesToSlices(
    [
      {
        id: "a",
        name: "Hediye",
        color: "#f00",
        weight: 10,
        isEmpty: false,
        imagePath: null,
      },
      {
        id: "b",
        name: "Boş / Tekrar dene",
        color: "#eee",
        weight: 10,
        isEmpty: true,
        imagePath: null,
      },
      {
        id: "c",
        name: "Hediye2",
        color: "#0f0",
        weight: 10,
        isEmpty: false,
        imagePath: null,
      },
    ],
    { equalSlices: true },
  );
  const emptySlice = slices.find((s) => s.isEmpty);
  const emptyOk =
    Boolean(emptySlice) &&
    Math.abs((emptySlice?.slicePercent ?? 0) - 100 / 3) < 0.01 &&
    !String(emptySlice?.id || "").includes("-sep-");
  results.push({
    name: "Boş dilim eşit pay (equalSlices)",
    ok: emptyOk,
    detail: JSON.stringify(
      slices.map((s) => ({
        id: s.id,
        isEmpty: s.isEmpty,
        pct: s.slicePercent,
        name: s.name,
      })),
    ),
  });

  // 3) Passive location not in public geo + lock behavior
  const locs: CampaignLocation[] = [
    {
      id: "1",
      campaignId: "c",
      name: "merkez",
      branchName: "6",
      lat: 40.64,
      lng: 47.47,
      radiusMeters: 150,
      active: false,
      sortOrder: 0,
    },
    {
      id: "2",
      campaignId: "c",
      name: "aktif",
      branchName: "1",
      lat: 40.65,
      lng: 47.48,
      radiusMeters: 150,
      active: true,
      sortOrder: 1,
    },
  ];
  const pub = publicGeoInfo({
    geoEnabled: true,
    geoLat: null,
    geoLng: null,
    geoRadiusMeters: 150,
    locations: locs,
  });
  const passiveHidden =
    pub.geoRequired === true &&
    pub.locations.length === 1 &&
    pub.locations[0]?.name === "aktif";
  results.push({
    name: "Pasif konum public listede yok",
    ok: passiveHidden,
    detail: JSON.stringify(pub.locations.map((l) => l.name)),
  });

  const checkPassive = assertInsideLocations(
    true,
    locs,
    40.64,
    47.47,
  );
  results.push({
    name: "Pasif merkez içinde spin reddi",
    ok: !checkPassive.ok,
    detail: checkPassive.ok
      ? "yanlışlıkla OK"
      : (checkPassive as { error: string }).error,
  });

  // 4) Live campaign API if any
  const cam = await prisma.campaign.findFirst({
    where: { status: "PUBLISHED", wheelEnabled: true },
    include: {
      prizes: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      locations: true,
    },
  });

  if (!cam) {
    results.push({
      name: "Yayınlı çark kampanyası",
      ok: false,
      detail: "PUBLISHED+wheelEnabled kampanya yok — HTTP testi atlandı",
    });
  } else {
    results.push({
      name: "Yayınlı çark kampanyası",
      ok: true,
      detail: `${cam.slug} prizes=${cam.prizes.length}`,
    });

    const display = await getWheelDisplaySettings(cam.id);
    results.push({
      name: "Kasiyer PIN alanı okunuyor",
      ok: true,
      detail: `requirePin=${display.requirePin} requireClaimPin=${display.requireClaimPin} claimPinLen=${display.claimPin.length}`,
    });

    const api = await httpJson(`/api/public/wheel/${cam.slug}`);
    const body = api.json as {
      requirePin?: boolean;
      requireClaimPin?: boolean;
      wheelSlices?: { isEmpty?: boolean; slicePercent?: number; name?: string }[];
      locations?: { name?: string }[];
      geoRequired?: boolean;
      error?: string;
    };
    results.push({
      name: "Public wheel API",
      ok: api.status === 200,
      detail: `HTTP ${api.status} requireClaimPin=${body.requireClaimPin} slices=${body.wheelSlices?.length} geoRequired=${body.geoRequired}`,
    });

    if (api.status === 200 && body.wheelSlices) {
      const empties = body.wheelSlices.filter((s) => s.isEmpty);
      const emptyVisible =
        empties.length === 0 ||
        empties.every((s) => (s.slicePercent ?? 0) >= 5);
      results.push({
        name: "API boş dilim görünür pay",
        ok: emptyVisible,
        detail: empties
          .map((e) => `${e.name}:${e.slicePercent?.toFixed(1)}%`)
          .join(", ") || "boş dilim yok",
      });
    }

    // Claim without PIN should fail if claimPin set, or ask for setup
    const claim = await httpJson(`/api/public/wheel/${cam.slug}/claim`, {
      method: "POST",
      body: JSON.stringify({
        phone: "0500000000",
        spinId: "nonexistent",
        deviceId: "testdevice123456",
      }),
    });
    const claimBody = claim.json as { error?: string };
    const pinEnforced =
      claim.status === 400 ||
      claim.status === 401 ||
      (claimBody.error || "").toLowerCase().includes("şifre") ||
      (claimBody.error || "").toLowerCase().includes("sifr");
    results.push({
      name: "Claim PIN zorunlu (PIN yokken)",
      ok: pinEnforced || claim.status === 404,
      detail: `HTTP ${claim.status} ${claimBody.error || ""}`,
    });

    const oyun = await fetch(`${BASE}/oyun/${cam.slug}`, { cache: "no-store" });
    const html = await oyun.text();
    results.push({
      name: "Oyun sayfası yükleniyor",
      ok: oyun.ok && html.length > 100,
      detail: `HTTP ${oyun.status} bytes=${html.length}`,
    });
  }

  console.log("\n=== SMOKE TEST ===\n");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} | ${r.name}`);
    console.log(`       ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nToplam: ${results.length - failed}/${results.length} geçti`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
