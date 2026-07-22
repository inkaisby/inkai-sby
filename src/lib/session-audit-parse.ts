export type ClientAuditMeta = {
  timezone?: string | null;
  language?: string | null;
  screen?: string | null;
  platform?: string | null;
};

export type SessionAuditSnapshot = {
  ip: string | null;
  userAgent: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  locationLabel: string | null;
  timezone: string | null;
  language: string | null;
  screen: string | null;
  platform: string | null;
};

/** Parse User-Agent sederhana (tanpa dependency). */
export function parseUserAgent(ua: string | null | undefined) {
  const raw = (ua || "").trim();
  if (!raw) {
    return {
      deviceType: null as string | null,
      browser: null as string | null,
      os: null as string | null,
    };
  }

  let deviceType = "Desktop";
  if (/ipad|tablet|kindle|silk|(android(?!.*mobile))/i.test(raw)) {
    deviceType = "Tablet";
  } else if (
    /mobi|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(raw)
  ) {
    deviceType = "Mobile";
  } else if (/bot|crawl|spider|slurp/i.test(raw)) {
    deviceType = "Bot";
  }

  let os: string | null = null;
  if (/iphone|ipad|ipod/i.test(raw)) {
    const m = raw.match(/OS\s([\d_]+)/i);
    os = m ? `iOS ${m[1].replace(/_/g, ".")}` : "iOS";
  } else if (/windows nt 10/i.test(raw)) os = "Windows 10/11";
  else if (/windows nt 6\.3/i.test(raw)) os = "Windows 8.1";
  else if (/windows nt 6\.1/i.test(raw)) os = "Windows 7";
  else if (/android/i.test(raw)) {
    const m = raw.match(/Android\s([\d._]+)/i);
    os = m ? `Android ${m[1].replace(/_/g, ".")}` : "Android";
  } else if (/mac os x/i.test(raw)) os = "macOS";
  else if (/linux/i.test(raw)) os = "Linux";
  else if (/cros/i.test(raw)) os = "Chrome OS";

  let browser: string | null = null;
  if (/edg\//i.test(raw)) {
    const m = raw.match(/Edg\/([\d.]+)/i);
    browser = m ? `Edge ${m[1]}` : "Edge";
  } else if (/opr\//i.test(raw) || /opera/i.test(raw)) {
    const m = raw.match(/(?:OPR|Opera)\/([\d.]+)/i);
    browser = m ? `Opera ${m[1]}` : "Opera";
  } else if (/chrome\//i.test(raw) && !/edg\//i.test(raw)) {
    const m = raw.match(/Chrome\/([\d.]+)/i);
    browser = m ? `Chrome ${m[1]}` : "Chrome";
  } else if (/safari\//i.test(raw) && !/chrome\//i.test(raw)) {
    const m = raw.match(/Version\/([\d.]+)/i);
    browser = m ? `Safari ${m[1]}` : "Safari";
  } else if (/firefox\//i.test(raw)) {
    const m = raw.match(/Firefox\/([\d.]+)/i);
    browser = m ? `Firefox ${m[1]}` : "Firefox";
  }

  if (browser) browser = browser.replace(/(\d+)\.[\d.]+/, "$1");
  if (os && /android|ios/i.test(os)) os = os.replace(/(\d+)\.[\d.]+/, "$1");

  return { deviceType, browser, os };
}

export function buildLocationLabel(parts: {
  city?: string | null;
  region?: string | null;
  country?: string | null;
}) {
  const bits = [parts.city, parts.region, parts.country]
    .map((x) => (x || "").trim())
    .filter(Boolean);
  if (bits.length === 0) return null;
  const uniq: string[] = [];
  for (const b of bits) {
    if (!uniq.includes(b)) uniq.push(b);
  }
  return uniq.join(", ");
}

export function countryCodeToName(code: string | null | undefined) {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  const map: Record<string, string> = {
    ID: "Indonesia",
    SG: "Singapore",
    MY: "Malaysia",
    US: "United States",
    AU: "Australia",
    JP: "Japan",
    KR: "Korea",
    NL: "Netherlands",
    DE: "Germany",
    GB: "United Kingdom",
  };
  return map[c] || c;
}

export function deviceSummary(snap: {
  deviceType?: string | null;
  browser?: string | null;
  os?: string | null;
}) {
  const parts = [snap.deviceType, snap.browser, snap.os].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}
