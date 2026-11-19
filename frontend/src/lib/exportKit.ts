import JSZip from "jszip";
import { CampaignAssets } from "@/types/campaign";
import { slugify } from "@/lib/utils";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCampaignJson(assets: CampaignAssets): void {
  const filename = `${slugify(assets.brief.productName)}-campaign-kit.json`;
  const cleanPayload = {
    ...assets,
    creatives: assets.creatives.map(({ svgMarkup, ...rest }) => ({
      ...rest,
      hasInlineSvg: Boolean(svgMarkup),
    })),
  };
  const blob = new Blob([JSON.stringify(cleanPayload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  triggerDownload(blob, filename);
}

function buildCopyDeckMarkdown(assets: CampaignAssets): string {
  const lines: string[] = [
    `# ${assets.brief.productName} — Campaign Copy & Art Kit`,
    ``,
    `- **Campaign ID:** \`${assets.campaignId}\``,
    `- **Generated:** ${assets.generatedAt}`,
    `- **Brand Tone:** ${assets.brief.brandTone}`,
    `- **Target Audience:** ${assets.brief.targetAudience}`,
    `- **Platforms:** ${assets.brief.platforms.join(", ")}`,
    ``,
    `## Art Direction`,
    assets.artDirectionSummary,
    ``,
    `## Color Palette`,
    ...assets.palette.map((c) => `- **${c.name}** \`${c.hex}\` — ${c.role}`),
    ``,
    `## Social Posts`,
  ];

  for (const post of assets.socialPosts) {
    lines.push(
      `### ${post.platform} — ${post.variantLabel}`,
      `**Hook:** ${post.hook}`,
      ``,
      post.body,
      ``,
      `**CTA:** ${post.callToAction}`,
      `_Best time: ${post.bestTimeToPost} | Est. benchmark: ${post.estimatedEngagement}_`,
      ``
    );
  }

  lines.push(`## Meta Ads Variants`);
  for (const ad of assets.metaAds) {
    lines.push(
      `### ${ad.angle}`,
      `- **Headline:** ${ad.headline}`,
      `- **Primary Text:** ${ad.primaryText}`,
      `- **Description:** ${ad.description}`,
      `- **CTA Button:** \`${ad.ctaLabel}\``,
      `- **Display URL:** ${ad.displayUrl}`,
      ``
    );
  }

  lines.push(`## Hashtags`, assets.hashtags.join(" "), ``);
  lines.push(`## Video Storyboard (15s)`);
  for (const frame of assets.storyboard) {
    lines.push(
      `### Scene ${frame.sceneNumber} (${frame.timecode}) — ${frame.title}`,
      `- **Visual:** ${frame.visualDirection}`,
      `- **Camera:** ${frame.cameraMove}`,
      `- **Audio:** ${frame.audioCue}`,
      `- **Overlay:** "${frame.captionOverlay}"`,
      ``
    );
  }

  return lines.join("\n");
}

function buildPaletteCss(assets: CampaignAssets): string {
  const vars = assets.palette
    .map((c, idx) => `  --brand-color-${idx + 1}: ${c.hex}; /* ${c.name} - ${c.role} */`)
    .join("\n");
  return `:root {\n${vars}\n}\n`;
}

export async function exportCampaignZip(assets: CampaignAssets): Promise<void> {
  const zip = new JSZip();
  const slug = slugify(assets.brief.productName);
  const root = zip.folder(`${slug}-campaign-kit`);
  if (!root) return;

  root.file("campaign-kit.json", JSON.stringify(assets, null, 2));
  root.file("copy-deck.md", buildCopyDeckMarkdown(assets));
  root.file("brand-palette.css", buildPaletteCss(assets));

  const creativesFolder = root.folder("creatives");
  if (creativesFolder) {
    for (let idx = 0; idx < assets.creatives.length; idx += 1) {
      const creative = assets.creatives[idx];
      if (creative.svgMarkup) {
        creativesFolder.file(
          `0${idx + 1}-${slugify(creative.title)}.svg`,
          creative.svgMarkup
        );
      } else if (creative.imageUrl && creative.imageUrl.startsWith("http")) {
        try {
          const resp = await fetch(creative.imageUrl);
          if (resp.ok) {
            const bytes = await resp.arrayBuffer();
            const ext = creative.imageUrl.includes(".png")
              ? "png"
              : creative.imageUrl.includes(".svg")
                ? "svg"
                : "jpg";
            creativesFolder.file(
              `0${idx + 1}-${slugify(creative.title)}.${ext}`,
              bytes
            );
          }
        } catch {
          // Skip remote asset if offline
        }
      }
    }
  }

  if (assets.videos && assets.videos.length > 0) {
    const videosFolder = root.folder("videos");
    if (videosFolder) {
      for (let idx = 0; idx < assets.videos.length; idx += 1) {
        const video = assets.videos[idx];
        try {
          const resp = await fetch(video.videoUrl);
          if (resp.ok) {
            const bytes = await resp.arrayBuffer();
            videosFolder.file(
              `0${idx + 1}-${slugify(video.title)}.mp4`,
              bytes
            );
          }
        } catch {
          // Skip if video cannot be fetched
        }
      }
    }
  }

  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, `${slug}-campaign-kit.zip`);
}
