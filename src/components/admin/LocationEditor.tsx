"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Loc = {
  id: string;
  name: string;
  branchName: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  active: boolean;
};

type Props = {
  /** @deprecated baseUrl kullanın — geriye dönük uyumluluk için tutuldu */
  campaignId?: string;
  /** Şube API kökü, örn. /api/campaigns/abc/locations veya /api/admin/feedback-boxes/abc/locations */
  baseUrl?: string;
  /** Etiketleri değiştirmek için (örn. "market" → "şube") */
  itemLabel?: string;
};

export default function LocationEditor({ campaignId, baseUrl, itemLabel = "market" }: Props) {
  const base = baseUrl ?? `/api/campaigns/${campaignId}/locations`;
  const [geoEnabled, setGeoEnabled] = useState(false);
  const [locations, setLocations] = useState<Loc[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState(120);
  const [geoBusy, setGeoBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(base);
    if (!res.ok) return;
    const data = await res.json();
    setGeoEnabled(Boolean(data.geoEnabled));
    setLocations(data.locations || []);
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleGeo(next: boolean) {
    setBusy(true);
    setError(null);
    setSavedMsg(null);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geoEnabled: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Kaydedilemedi — ayar eski haliyle kaldı.");
        // Sunucu reddettiyse checkbox'ı gerçek durumla senkron tut (yanıltıcı olmasın)
        void load();
        return;
      }
      setGeoEnabled(Boolean(data.geoEnabled));
      setLocations(data.locations || []);
      setSavedMsg(
        data.geoEnabled
          ? "Kaydedildi: konum kilidi AÇIK — yalnız listedeki marketlerde oynanır."
          : "Kaydedildi: konum kilidi KAPALI — konum istenmeyecek.",
      );
    } catch {
      setError("Bağlantı hatası — ayar kaydedilemedi, tekrar deneyin.");
      void load();
    } finally {
      setBusy(false);
    }
  }

  function captureHere() {
    if (!navigator.geolocation) {
      setError("Konum desteklenmiyor.");
      return;
    }
    setGeoBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(7));
        setLng(pos.coords.longitude.toFixed(7));
        setGeoBusy(false);
      },
      () => {
        setGeoBusy(false);
        setError("GPS alınamadı.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  async function addLocation(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSavedMsg(null);
    const res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        branchName: branch.trim(),
        lat: Number(lat),
        lng: Number(lng),
        radiusMeters: radius,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Eklenemedi");
      return;
    }
    setName("");
    setBranch("");
    void load();
  }

  async function removeLoc(id: string) {
    if (!confirm("Silinsin mi?")) return;
    setBusy(true);
    await fetch(`${base}/${id}`, {
      method: "DELETE",
    });
    setBusy(false);
    void load();
  }

  async function toggleActive(loc: Loc) {
    setBusy(true);
    setError(null);
    setSavedMsg(null);
    const res = await fetch(`${base}/${loc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !loc.active }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Durum güncellenemedi");
      return;
    }
    if (typeof data.geoEnabled === "boolean") {
      const wasOn = geoEnabled;
      setGeoEnabled(data.geoEnabled);
      if (wasOn && !data.geoEnabled) {
        setSavedMsg(
          "Son aktif market pasife alındığı üçün konum kilidi otomatik KAPANDI.",
        );
      }
    }
    if (Array.isArray(data.locations)) {
      setLocations(data.locations);
    } else {
      void load();
    }
  }

  async function patchRadius(loc: Loc, next: number) {
    const radiusMeters = Math.max(30, Math.min(2000, next));
    setBusy(true);
    setError(null);
    const res = await fetch(`${base}/${loc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ radiusMeters }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Yarıçap güncellenemedi");
      return;
    }
    void load();
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-line bg-white/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Konum</h3>
        <label className="flex items-center gap-1.5 text-xs font-medium">
          <input
            type="checkbox"
            checked={geoEnabled}
            disabled={busy}
            onChange={(e) => void toggleGeo(e.target.checked)}
          />
          Kilit
        </label>
      </div>
      <p className="text-[11px] leading-snug text-muted">
        Açıkken yalnızca listedeki {itemLabel}lerde işlem yapılabilir. Şube adı
        analitikte görünür.
      </p>
      <p className="text-[11px] font-semibold">
        Şu an:{" "}
        <span className={geoEnabled ? "text-danger" : "text-emerald-700"}>
          Kilit {geoEnabled ? "AÇIK" : "KAPALI"}
        </span>
        {geoEnabled
          ? ` · ${locations.filter((l) => l.active).length} aktif ${itemLabel}`
          : " · konum istənmir"}
      </p>

      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {savedMsg ? (
        <p className="text-xs font-medium text-emerald-700">{savedMsg}</p>
      ) : null}

      {locations.length === 0 ? (
        <p className="text-xs text-muted">Konum yok.</p>
      ) : (
        <ul className="divide-y divide-line/70 rounded-lg border border-line">
          {locations.map((loc) => (
            <li
              key={loc.id}
              className={`flex flex-wrap items-center gap-x-2 gap-y-1 px-2.5 py-2 text-xs ${
                loc.active ? "bg-card" : "bg-bg-deep/40 opacity-60"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-sm">
                  {loc.name}
                  {loc.branchName ? (
                    <span className="font-normal text-muted">
                      {" "}
                      · {loc.branchName}
                    </span>
                  ) : null}{" "}
                  <span
                    className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      loc.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-danger/10 text-danger"
                    }`}
                  >
                    {loc.active ? "AKTİF ✓" : "PASİF ✗"}
                  </span>
                </p>
                <p className="font-mono text-[10px] text-muted">
                  {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                </p>
              </div>
              <label className="flex items-center gap-1 text-[11px] text-muted">
                ±
                <input
                  type="number"
                  min={30}
                  max={2000}
                  disabled={busy}
                  defaultValue={loc.radiusMeters}
                  key={`${loc.id}-${loc.radiusMeters}`}
                  onBlur={(e) => {
                    const v = Number(e.target.value) || loc.radiusMeters;
                    if (v !== loc.radiusMeters) void patchRadius(loc, v);
                  }}
                  className="w-14 rounded border border-line bg-white px-1 py-0.5 font-mono"
                />
                m
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggleActive(loc)}
                title={
                  loc.active
                    ? `Bu ${itemLabel}i pasifə al (siyahıdan gizlə)`
                    : `Bu ${itemLabel}i aktivləştir`
                }
                className="rounded border border-line px-1.5 py-0.5"
              >
                {loc.active ? "Pasifə al" : "Aktivləştir"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void removeLoc(loc.id)}
                className="rounded border border-danger/40 px-1.5 py-0.5 text-danger"
              >
                Sil
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={addLocation}
        className="grid grid-cols-2 gap-1.5 rounded-lg border border-dashed border-line bg-bg-deep/20 p-2 sm:grid-cols-6"
      >
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={itemLabel === "market" ? "Market adı" : "Şube adı"}
          className="col-span-2 rounded-md border border-line bg-white px-2 py-1.5 text-sm sm:col-span-2"
        />
        <input
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          placeholder="Şube"
          className="col-span-2 rounded-md border border-line bg-white px-2 py-1.5 text-sm sm:col-span-1"
        />
        <input
          required
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          placeholder="lat"
          className="rounded-md border border-line bg-white px-2 py-1.5 font-mono text-xs"
        />
        <input
          required
          value={lng}
          onChange={(e) => setLng(e.target.value)}
          placeholder="lng"
          className="rounded-md border border-line bg-white px-2 py-1.5 font-mono text-xs"
        />
        <input
          type="number"
          min={30}
          max={2000}
          value={radius}
          onChange={(e) =>
            setRadius(Math.max(30, Math.min(2000, Number(e.target.value) || 120)))
          }
          title="Yarıçap (m)"
          className="rounded-md border border-line bg-white px-2 py-1.5 font-mono text-xs"
        />
        <button
          type="button"
          disabled={geoBusy}
          onClick={captureHere}
          className="rounded-md border border-line px-2 py-1.5 text-xs disabled:opacity-60"
        >
          {geoBusy ? "GPS…" : "GPS al"}
        </button>
        <button
          type="submit"
          disabled={busy}
          className="col-span-2 rounded-md bg-accent px-2 py-1.5 text-xs font-medium text-white disabled:opacity-60 sm:col-span-1"
        >
          Ekle
        </button>
      </form>
    </div>
  );
}
