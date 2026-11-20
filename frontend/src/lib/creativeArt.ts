function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type CreativeMotif = "bottle" | "earbuds" | "matcha" | "abstract";

export interface CreativeArtOptions {
  brandName: string;
  headline: string;
  subline: string;
  badge: string;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  bgHex: string;
  motif: CreativeMotif;
  variant: 0 | 1 | 2 | 3;
}

function renderMotifShapes(
  motif: CreativeMotif,
  primaryHex: string,
  secondaryHex: string,
  accentHex: string,
  variant: number
): string {
  if (motif === "bottle") {
    return `
      <g transform="translate(560, 125)">
        <ellipse cx="110" cy="405" rx="92" ry="18" fill="${primaryHex}" opacity="0.28" filter="url(#blurSoft)"/>
        <rect x="74" y="10" width="72" height="32" rx="10" fill="#1F2937" stroke="rgba(255,255,255,0.28)" stroke-width="1.5"/>
        <rect x="66" y="42" width="88" height="14" rx="7" fill="${accentHex}" opacity="0.95" filter="url(#glowRing)"/>
        <rect x="52" y="56" width="116" height="326" rx="34" fill="url(#objGrad)" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>
        <rect x="68" y="88" width="16" height="260" rx="8" fill="rgba(255,255,255,0.16)"/>
        <circle cx="110" cy="186" r="34" fill="none" stroke="${accentHex}" stroke-width="2.5" stroke-dasharray="6 5" opacity="0.85"/>
        <circle cx="110" cy="186" r="18" fill="${secondaryHex}" opacity="0.35"/>
        <path d="M110 165 C121 180 123 190 110 202 C97 190 99 180 110 165 Z" fill="${accentHex}" opacity="0.95"/>
        <text x="110" y="268" text-anchor="middle" fill="rgba(255,255,255,0.72)" font-family="monospace" font-size="11" letter-spacing="3">UV-C 99.9%</text>
      </g>
    `;
  }

  if (motif === "earbuds") {
    return `
      <g transform="translate(520, 145)">
        <circle cx="155" cy="180" r="142" fill="none" stroke="${primaryHex}" stroke-width="1.2" opacity="0.32"/>
        <circle cx="155" cy="180" r="108" fill="none" stroke="${accentHex}" stroke-width="1.5" stroke-dasharray="10 8" opacity="0.5"/>
        <circle cx="155" cy="180" r="72" fill="${primaryHex}" opacity="0.16" filter="url(#blurSoft)"/>
        <!-- Left Earbud -->
        <g transform="translate(75, 115) rotate(${variant % 2 === 0 ? -12 : -6})">
          <rect x="18" y="45" width="24" height="118" rx="12" fill="url(#objGrad)" stroke="rgba(255,255,255,0.28)" stroke-width="1.5"/>
          <ellipse cx="32" cy="48" rx="34" ry="30" fill="#181822" stroke="rgba(255,255,255,0.28)" stroke-width="1.5"/>
          <ellipse cx="14" cy="48" rx="14" ry="18" fill="${accentHex}" opacity="0.9"/>
          <rect x="26" y="76" width="8" height="44" rx="4" fill="${primaryHex}" opacity="0.95"/>
        </g>
        <!-- Right Earbud -->
        <g transform="translate(178, 128) rotate(${variant % 2 === 0 ? 14 : 8})">
          <rect x="18" y="45" width="24" height="118" rx="12" fill="url(#objGrad)" stroke="rgba(255,255,255,0.28)" stroke-width="1.5"/>
          <ellipse cx="28" cy="48" rx="34" ry="30" fill="#181822" stroke="rgba(255,255,255,0.28)" stroke-width="1.5"/>
          <ellipse cx="46" cy="48" rx="14" ry="18" fill="${secondaryHex}" opacity="0.9"/>
          <rect x="26" y="76" width="8" height="44" rx="4" fill="${accentHex}" opacity="0.95"/>
        </g>
        <!-- Soundwave bars -->
        <g transform="translate(65, 318)">
          <rect x="0" y="12" width="6" height="24" rx="3" fill="${primaryHex}" opacity="0.7"/>
          <rect x="16" y="4" width="6" height="40" rx="3" fill="${accentHex}" opacity="0.95"/>
          <rect x="32" y="16" width="6" height="16" rx="3" fill="${primaryHex}" opacity="0.6"/>
          <rect x="48" y="0" width="6" height="48" rx="3" fill="${secondaryHex}" opacity="0.95"/>
          <rect x="64" y="10" width="6" height="28" rx="3" fill="${accentHex}" opacity="0.8"/>
          <rect x="80" y="18" width="6" height="12" rx="3" fill="${primaryHex}" opacity="0.5"/>
          <rect x="96" y="6" width="6" height="36" rx="3" fill="${accentHex}" opacity="0.9"/>
          <rect x="112" y="14" width="6" height="20" rx="3" fill="${secondaryHex}" opacity="0.75"/>
          <rect x="128" y="2" width="6" height="44" rx="3" fill="${primaryHex}" opacity="0.9"/>
          <rect x="144" y="14" width="6" height="20" rx="3" fill="${accentHex}" opacity="0.65"/>
        </g>
      </g>
    `;
  }

  if (motif === "matcha") {
    return `
      <g transform="translate(525, 130)">
        <ellipse cx="145" cy="340" rx="118" ry="22" fill="${primaryHex}" opacity="0.25" filter="url(#blurSoft)"/>
        <!-- Ceramic Chawan Bowl -->
        <path d="M40 190 C40 295 85 332 145 332 C205 332 250 295 250 190 Z" fill="#171917" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>
        <ellipse cx="145" cy="190" rx="105" ry="30" fill="#1F241F" stroke="rgba(255,255,255,0.24)" stroke-width="1.5"/>
        <ellipse cx="145" cy="192" rx="92" ry="23" fill="url(#objGrad)"/>
        <ellipse cx="132" cy="188" rx="48" ry="10" fill="${accentHex}" opacity="0.38"/>
        <!-- Tin Canister behind -->
        <g transform="translate(168, 42)">
          <rect x="0" y="14" width="92" height="122" rx="14" fill="#111513" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>
          <ellipse cx="46" cy="14" rx="46" ry="12" fill="#232B25" stroke="rgba(255,255,255,0.25)" stroke-width="1.2"/>
          <rect x="16" y="48" width="60" height="50" rx="6" fill="${primaryHex}" opacity="0.22" stroke="${primaryHex}" stroke-width="1"/>
          <text x="46" y="77" text-anchor="middle" fill="${accentHex}" font-family="monospace" font-size="11" letter-spacing="2">UJI 01</text>
        </g>
        <!-- Steam / Aroma arcs -->
        <path d="M105 140 Q95 110 112 84" fill="none" stroke="${accentHex}" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
        <path d="M138 134 Q150 98 132 66" fill="none" stroke="${primaryHex}" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
      </g>
    `;
  }

  // Abstract sculptural campaign visual for any custom brief
  return `
    <g transform="translate(530, 140)">
      <circle cx="145" cy="175" r="132" fill="${primaryHex}" opacity="0.2" filter="url(#blurSoft)"/>
      <polygon points="145,40 265,175 145,310 25,175" fill="url(#objGrad)" opacity="0.88" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
      <polygon points="145,86 218,175 145,264 72,175" fill="none" stroke="${accentHex}" stroke-width="2" opacity="0.9"/>
      <circle cx="145" cy="175" r="34" fill="${secondaryHex}" opacity="0.85"/>
      <circle cx="145" cy="175" r="62" fill="none" stroke="rgba(255,255,255,0.28)" stroke-dasharray="6 6"/>
    </g>
  `;
}

export function generateCreativeSvg(opts: CreativeArtOptions): {
  svgMarkup: string;
  dataUrl: string;
} {
  const brand = escapeXml(opts.brandName.toUpperCase());
  const headline = escapeXml(opts.headline);
  const subline = escapeXml(opts.subline);
  const badge = escapeXml(opts.badge);

  const angleShift = opts.variant * 18;
  const motifSvg = renderMotifShapes(
    opts.motif,
    opts.primaryHex,
    opts.secondaryHex,
    opts.accentHex,
    opts.variant
  );

  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 580" width="900" height="580">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${opts.bgHex}" />
      <stop offset="55%" stop-color="#0D0D14" />
      <stop offset="100%" stop-color="#07070A" />
    </linearGradient>
    <radialGradient id="ambientA" cx="${72 - angleShift / 3}%" cy="32%" r="55%">
      <stop offset="0%" stop-color="${opts.primaryHex}" stop-opacity="0.48" />
      <stop offset="100%" stop-color="${opts.primaryHex}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="ambientB" cx="24%" cy="84%" r="50%">
      <stop offset="0%" stop-color="${opts.secondaryHex}" stop-opacity="0.34" />
      <stop offset="100%" stop-color="${opts.secondaryHex}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="objGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${opts.primaryHex}" />
      <stop offset="52%" stop-color="${opts.secondaryHex}" />
      <stop offset="100%" stop-color="#14141C" />
    </linearGradient>
    <filter id="blurSoft" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="24" />
    </filter>
    <filter id="glowRing" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <pattern id="microGrid" width="28" height="28" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" fill="rgba(255,255,255,0.08)" />
    </pattern>
  </defs>

  <rect width="900" height="580" fill="url(#bgGrad)" />
  <rect width="900" height="580" fill="url(#microGrid)" />
  <rect width="900" height="580" fill="url(#ambientA)" />
  <rect width="900" height="580" fill="url(#ambientB)" />

  <!-- Subtle architectural frame lines -->
  <rect x="28" y="28" width="844" height="524" rx="22" fill="none" stroke="rgba(255,255,255,0.11)" stroke-width="1" />
  <line x1="28" y1="98" x2="872" y2="98" stroke="rgba(255,255,255,0.07)" stroke-width="1" />

  <!-- Top bar metadata -->
  <circle cx="62" cy="64" r="5" fill="${opts.accentHex}" />
  <text x="78" y="69" fill="rgba(255,255,255,0.88)" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="700" letter-spacing="3.5">${brand}</text>

  <rect x="652" y="48" width="194" height="30" rx="15" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.16)" stroke-width="1" />
  <text x="749" y="68" text-anchor="middle" fill="${opts.accentHex}" font-family="monospace" font-size="11" font-weight="600" letter-spacing="1.5">${badge}</text>

  <!-- Sculptural Product / Visual Motif -->
  ${motifSvg}

  <!-- Left Editorial Typography Column -->
  <g transform="translate(64, 168)">
    <rect x="0" y="0" width="144" height="26" rx="13" fill="${opts.primaryHex}" fill-opacity="0.18" stroke="${opts.primaryHex}" stroke-opacity="0.5" />
    <text x="72" y="17" text-anchor="middle" fill="#FFFFFF" font-family="monospace" font-size="11" letter-spacing="1.4">@VISUALAGENT</text>

    <text x="0" y="96" fill="#FFFFFF" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="800" letter-spacing="-1.2">${headline.slice(0, 22)}</text>
    ${
      headline.length > 22
        ? `<text x="0" y="148" fill="${opts.accentHex}" font-family="system-ui, -apple-system, sans-serif" font-size="40" font-weight="800" letter-spacing="-1">${headline.slice(22, 46).trim()}</text>`
        : ""
    }

    <text x="0" y="${headline.length > 22 ? 198 : 148}" fill="rgba(255,255,255,0.72)" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="400">${subline.slice(0, 48)}</text>
    ${
      subline.length > 48
        ? `<text x="0" y="${headline.length > 22 ? 224 : 174}" fill="rgba(255,255,255,0.58)" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="400">${subline.slice(48, 96).trim()}</text>`
        : ""
    }

    <!-- Palette Swatch Strip inside Artwork -->
    <g transform="translate(0, 286)">
      <rect x="0" y="0" width="28" height="28" rx="8" fill="${opts.primaryHex}" stroke="rgba(255,255,255,0.28)" />
      <rect x="38" y="0" width="28" height="28" rx="8" fill="${opts.secondaryHex}" stroke="rgba(255,255,255,0.28)" />
      <rect x="76" y="0" width="28" height="28" rx="8" fill="${opts.accentHex}" stroke="rgba(255,255,255,0.28)" />
      <text x="120" y="19" fill="rgba(255,255,255,0.5)" font-family="monospace" font-size="12" letter-spacing="1">${opts.primaryHex} · ${opts.accentHex}</text>
    </g>
  </g>

  <!-- Bottom hairline footer -->
  <text x="64" y="532" fill="rgba(255,255,255,0.4)" font-family="monospace" font-size="11" letter-spacing="1.5">PIXELATE // STUDIO RENDER 0${opts.variant + 1}</text>
  <text x="836" y="532" text-anchor="end" fill="rgba(255,255,255,0.4)" font-family="monospace" font-size="11">BAND MULTI-AGENT PIPELINE</text>
</svg>`;

  const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  return { svgMarkup, dataUrl };
}
