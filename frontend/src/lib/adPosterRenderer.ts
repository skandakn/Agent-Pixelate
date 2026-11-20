export type PosterTheme = "billboard" | "swiss" | "luxury" | "cyber";

export interface PosterThemeDetails {
  id: PosterTheme;
  label: string;
  accentColor: string;
  frameColor: string;
  kickerBg: string;
  kickerText: string;
  ctaBg: string;
  ctaText: string;
  fontFamilyDisplay: string;
  fontFamilyMono: string;
}

export const POSTER_THEME_CONFIGS: Record<PosterTheme, PosterThemeDetails> = {
  billboard: {
    id: "billboard",
    label: "Street Billboard",
    accentColor: "#00E599",
    frameColor: "#00E599",
    kickerBg: "#00E599",
    kickerText: "#000000",
    ctaBg: "#00E599",
    ctaText: "#000000",
    fontFamilyDisplay: "Archivo, Impact, sans-serif",
    fontFamilyMono: "'JetBrains Mono', monospace",
  },
  swiss: {
    id: "swiss",
    label: "Swiss Grid",
    accentColor: "#FFFFFF",
    frameColor: "rgba(255, 255, 255, 0.4)",
    kickerBg: "#FFFFFF",
    kickerText: "#000000",
    ctaBg: "#FFFFFF",
    ctaText: "#000000",
    fontFamilyDisplay: "'Hanken Grotesk', Helvetica, sans-serif",
    fontFamilyMono: "'JetBrains Mono', monospace",
  },
  luxury: {
    id: "luxury",
    label: "Luxury Editorial",
    accentColor: "#D4AF37",
    frameColor: "rgba(212, 175, 55, 0.8)",
    kickerBg: "#D4AF37",
    kickerText: "#000000",
    ctaBg: "#D4AF37",
    ctaText: "#000000",
    fontFamilyDisplay: "Georgia, serif",
    fontFamilyMono: "'JetBrains Mono', monospace",
  },
  cyber: {
    id: "cyber",
    label: "Cyber Tech HUD",
    accentColor: "#06B6D4",
    frameColor: "rgba(6, 182, 212, 0.8)",
    kickerBg: "#06B6D4",
    kickerText: "#000000",
    ctaBg: "#06B6D4",
    ctaText: "#000000",
    fontFamilyDisplay: "'Plus Jakarta Sans', sans-serif",
    fontFamilyMono: "'JetBrains Mono', monospace",
  },
};

export interface AdPosterConfig {
  productName: string;
  headline: string;
  subheadline?: string;
  badge?: string;
  ctaText?: string;
  features?: string[];
  theme: PosterTheme;
  imageUrl: string;
  aspectRatio: "4:5" | "1:1" | "9:16" | "16:9";
  platform?: string;
  brandTone?: string;
}

export function getDimensions(aspectRatio: "4:5" | "1:1" | "9:16" | "16:9"): { width: number; height: number } {
  switch (aspectRatio) {
    case "4:5":
      return { width: 1200, height: 1500 };
    case "1:1":
      return { width: 1200, height: 1200 };
    case "9:16":
      return { width: 1080, height: 1920 };
    case "16:9":
      return { width: 1600, height: 900 };
    default:
      return { width: 1200, height: 1500 };
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Fallback: try loading without crossOrigin if CORS fails
      const fallbackImg = new Image();
      fallbackImg.onload = () => resolve(fallbackImg);
      fallbackImg.onerror = (err) => reject(err);
      fallbackImg.src = src;
    };
    img.src = src;
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export async function renderAdPosterToCanvas(config: AdPosterConfig): Promise<HTMLCanvasElement> {
  const { width, height } = getDimensions(config.aspectRatio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not acquire 2D canvas context");

  // Base background
  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, width, height);

  // Load and draw product photography
  try {
    const img = await loadImage(config.imageUrl);
    const imgAspect = img.width / img.height;
    const canvasAspect = width / height;
    let renderW = width;
    let renderH = height;
    let offsetX = 0;
    let offsetY = 0;

    if (imgAspect > canvasAspect) {
      renderH = height;
      renderW = height * imgAspect;
      offsetX = (width - renderW) / 2;
    } else {
      renderW = width;
      renderH = width / imgAspect;
      offsetY = (height - renderH) / 2;
    }

    ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
  } catch (err) {
    // If image fails to load, draw a sleek dark studio gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, "#121218");
    grad.addColorStop(0.5, "#1A1A24");
    grad.addColorStop(1, "#09090C");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // Common typography & contrast scrims
  const topGrad = ctx.createLinearGradient(0, 0, 0, height * 0.35);
  topGrad.addColorStop(0, "rgba(9, 9, 12, 0.88)");
  topGrad.addColorStop(0.6, "rgba(9, 9, 12, 0.45)");
  topGrad.addColorStop(1, "rgba(9, 9, 12, 0)");
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, width, height * 0.35);

  const botGrad = ctx.createLinearGradient(0, height * 0.4, 0, height);
  botGrad.addColorStop(0, "rgba(9, 9, 12, 0)");
  botGrad.addColorStop(0.45, "rgba(9, 9, 12, 0.75)");
  botGrad.addColorStop(1, "rgba(9, 9, 12, 0.96)");
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, height * 0.4, width, height * 0.6);

  const brand = (config.productName || "PRODUCT").toUpperCase();
  const headline = (config.headline || "ENGINEERED FOR IMPACT").toUpperCase();
  const subline = config.subheadline || "Commercial release // Global availability.";
  const badge = (config.badge || "OFFICIAL CAMPAIGN // 2026").toUpperCase();
  const cta = (config.ctaText || "ORDER NOW →").toUpperCase();
  const features = config.features || ["100% RECYCLED MATERIALS", "COMMERCIAL CRAFTSMANSHIP", "LIMITED EDITION"];

  // THEME SPECIFIC POSTER GRAPHICS
  if (config.theme === "billboard") {
    // Street Billboard Style: Bold, high voltage mint accents, heavy block typography
    const accent = "#00E599";

    // Outer border
    ctx.lineWidth = 14;
    ctx.strokeStyle = "#000000";
    ctx.strokeRect(7, 7, width - 14, height - 14);

    ctx.lineWidth = 4;
    ctx.strokeStyle = accent;
    ctx.strokeRect(14, 14, width - 28, height - 28);

    // Top Brand Bar
    ctx.fillStyle = "#000000";
    ctx.fillRect(36, 36, 190, 44);
    ctx.lineWidth = 2;
    ctx.strokeStyle = accent;
    ctx.strokeRect(36, 36, 190, 44);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 18px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(brand.slice(0, 16), 131, 64);

    // Top Kicker Badge
    ctx.fillStyle = accent;
    ctx.fillRect(width - 290, 36, 254, 44);
    ctx.fillStyle = "#000000";
    ctx.font = "900 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText(badge.slice(0, 24), width - 163, 63);

    // Big Punchy Ad Headline
    ctx.textAlign = "left";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 68px 'Plus Jakarta Sans', system-ui, sans-serif";
    const lines = wrapText(ctx, headline, width - 120);
    let startY = height - 380 - (lines.length - 1) * 72;

    lines.forEach((line, i) => {
      // Accent color on first word or last line
      if (i === lines.length - 1) {
        ctx.fillStyle = accent;
      } else {
        ctx.fillStyle = "#FFFFFF";
      }
      ctx.fillText(line, 50, startY + i * 74);
    });

    // Subtitle
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "500 22px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.fillText(subline.slice(0, 75), 52, height - 285);

    // Feature Badges
    let pillX = 52;
    features.slice(0, 3).forEach((feat) => {
      ctx.font = "700 14px monospace";
      const txt = `● ${feat}`;
      const pillW = ctx.measureText(txt).width + 30;
      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.fillRect(pillX, height - 250, pillW, 36);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.strokeRect(pillX, height - 250, pillW, 36);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(txt, pillX + 15, height - 226);
      pillX += pillW + 14;
    });

    // Bottom CTA Button & Website Lockup
    ctx.fillStyle = accent;
    ctx.fillRect(width - 320, height - 120, 268, 62);
    ctx.fillStyle = "#000000";
    ctx.font = "900 20px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(cta, width - 186, height - 81);

    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "700 14px monospace";
    ctx.fillText(`AVAILABLE GLOBALLY // SS-26 CAMPAIGN // @AGENT_PIXELATE`, 52, height - 82);
  } else if (config.theme === "swiss") {
    // Swiss / International Style: Architectural grid lines, numbered micro-specs, Helvetica styling
    const accent = "#FFFFFF";

    // Clean hairline border
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.strokeRect(40, 40, width - 80, height - 80);

    // Grid divider line
    ctx.beginPath();
    ctx.moveTo(40, 110);
    ctx.lineTo(width - 40, 110);
    ctx.stroke();

    // Top Brand & Coordinates
    ctx.fillStyle = accent;
    ctx.font = "800 20px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${brand} / SPEC. 01`, 60, 82);

    ctx.font = "600 13px monospace";
    ctx.textAlign = "right";
    ctx.fillText(badge, width - 60, 82);

    // Numbered Specs Column Top-Right
    ctx.textAlign = "left";
    features.slice(0, 3).forEach((feat, idx) => {
      ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
      ctx.font = "600 11px monospace";
      ctx.fillText(`[0${idx + 1}]`, width - 340, 160 + idx * 32);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(feat, width - 300, 160 + idx * 32);
    });

    // Bold Swiss Display Headline
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 64px 'Plus Jakarta Sans', system-ui, sans-serif";
    const lines = wrapText(ctx, headline, width - 120);
    let startY = height - 340 - (lines.length - 1) * 70;

    lines.forEach((line, i) => {
      ctx.fillText(line, 60, startY + i * 70);
    });

    // Subtitle
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = "400 20px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.fillText(subline.slice(0, 80), 60, height - 220);

    // Hairline divider above footer
    ctx.beginPath();
    ctx.moveTo(40, height - 130);
    ctx.lineTo(width - 40, height - 130);
    ctx.stroke();

    // Footer Lockup
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 14px monospace";
    ctx.fillText(`EDITION 01/500 // TOKYO • KYOTO • NEW YORK`, 60, height - 85);

    ctx.textAlign = "right";
    ctx.font = "800 16px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.fillText(cta, width - 60, height - 85);
  } else if (config.theme === "luxury") {
    // Luxury Editorial: Elegant letter spacing, gold accents, museum-grade framing
    const gold = "#D4AF37";

    // Double elegant gold border
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = gold;
    ctx.strokeRect(40, 40, width - 80, height - 80);
    ctx.strokeRect(50, 50, width - 100, height - 100);

    // Top Center Crest / Brand
    ctx.fillStyle = gold;
    ctx.font = "700 13px monospace";
    ctx.textAlign = "center";
    ctx.fillText("— HAUTE DIRECTION —", width / 2, 85);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 24px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.fillText(brand, width / 2, 125);

    // Roman numeral & edition
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "600 12px monospace";
    ctx.fillText("MMXXVI • ARCHIVE NO. 884", width / 2, 155);

    // Refined Typography Headline
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 56px 'Plus Jakarta Sans', system-ui, sans-serif";
    const lines = wrapText(ctx, headline, width - 160);
    let startY = height - 340 - (lines.length - 1) * 64;

    lines.forEach((line, i) => {
      ctx.fillText(line, width / 2, startY + i * 64);
    });

    // Subtitle
    ctx.fillStyle = gold;
    ctx.font = "400 18px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.fillText(subline.slice(0, 80), width / 2, height - 200);

    // Features
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "600 12px monospace";
    ctx.fillText(features.slice(0, 3).join("   •   "), width / 2, height - 145);

    // CTA
    ctx.fillStyle = gold;
    ctx.font = "800 16px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.fillText(cta, width / 2, height - 85);
  } else {
    // Cyber Tech: HUD brackets, telemetry markers, glowing cyan accent
    const cyan = "#06B6D4";

    // Corner HUD Brackets
    ctx.lineWidth = 3;
    ctx.strokeStyle = cyan;
    const bLen = 40;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(35, 35 + bLen);
    ctx.lineTo(35, 35);
    ctx.lineTo(35 + bLen, 35);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(width - 35 - bLen, 35);
    ctx.lineTo(width - 35, 35);
    ctx.lineTo(width - 35, 35 + bLen);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(35, height - 35 - bLen);
    ctx.lineTo(35, height - 35);
    ctx.lineTo(35 + bLen, height - 35);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(width - 35 - bLen, height - 35);
    ctx.lineTo(width - 35, height - 35);
    ctx.lineTo(width - 35, height - 35 - bLen);
    ctx.stroke();

    // Top HUD Telemetry
    ctx.fillStyle = cyan;
    ctx.font = "700 13px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`SYS//TARGET: ${brand} [ONLINE]`, 60, 68);

    ctx.textAlign = "right";
    ctx.fillText(`TELEMETRY: VERIFIED // LATENCY: 0.8MS`, width - 60, 68);

    // Crosshairs
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
    ctx.beginPath();
    ctx.moveTo(width / 2 - 20, 65);
    ctx.lineTo(width / 2 + 20, 65);
    ctx.moveTo(width / 2, 45);
    ctx.lineTo(width / 2, 85);
    ctx.stroke();

    // Futuristic Bold Headline
    ctx.textAlign = "left";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 64px 'Plus Jakarta Sans', system-ui, sans-serif";
    const lines = wrapText(ctx, headline, width - 140);
    let startY = height - 360 - (lines.length - 1) * 70;

    lines.forEach((line, i) => {
      if (i === 0) {
        ctx.fillStyle = cyan;
      } else {
        ctx.fillStyle = "#FFFFFF";
      }
      ctx.fillText(line, 60, startY + i * 70);
    });

    // Subtitle
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "500 20px 'Plus Jakarta Sans', system-ui, sans-serif";
    ctx.fillText(subline.slice(0, 80), 60, height - 240);

    // Feature HUD Badges
    let fX = 60;
    features.slice(0, 3).forEach((feat) => {
      ctx.font = "700 13px monospace";
      const txt = `[+] ${feat}`;
      const fW = ctx.measureText(txt).width + 24;
      ctx.fillStyle = "rgba(6, 182, 212, 0.15)";
      ctx.fillRect(fX, height - 205, fW, 32);
      ctx.lineWidth = 1;
      ctx.strokeStyle = cyan;
      ctx.strokeRect(fX, height - 205, fW, 32);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(txt, fX + 12, height - 184);
      fX += fW + 12;
    });

    // Bottom Bar
    ctx.fillStyle = cyan;
    ctx.fillRect(width - 280, height - 110, 220, 50);
    ctx.fillStyle = "#000000";
    ctx.font = "900 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText(cta, width - 170, height - 78);

    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "600 12px monospace";
    ctx.fillText(`AUTHENTICATED BY PIXELATE NEURAL MESH`, 60, height - 78);
  }

  return canvas;
}

export async function downloadAdPoster(config: AdPosterConfig, customFilename?: string): Promise<void> {
  const canvas = await renderAdPosterToCanvas(config);
  const cleanBrand = (config.productName || "product").toLowerCase().replace(/[^a-z0-9]/g, "-");
  const filename = customFilename || `${cleanBrand}-ad-poster-${config.theme}.png`;

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

export async function copyAdPosterToClipboard(config: AdPosterConfig): Promise<boolean> {
  try {
    const canvas = await renderAdPosterToCanvas(config);
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) return resolve(false);
        try {
          if (navigator.clipboard && (window as any).ClipboardItem) {
            await navigator.clipboard.write([
              new (window as any).ClipboardItem({ "image/png": blob }),
            ]);
            resolve(true);
          } else {
            resolve(false);
          }
        } catch {
          resolve(false);
        }
      }, "image/png");
    });
  } catch {
    return false;
  }
}
