import {
  BrandTone,
  CampaignAssets,
  CampaignBrief,
  ColorSwatch,
  ContextHandoffPayload,
  DemoPreset,
  MetaAdVariant,
  SocialPost,
  StoryboardFrame,
  VisualCreative,
  VisualOption,
} from "@/types/campaign";
import { CreativeMotif, generateCreativeSvg } from "@/lib/creativeArt";
import { getProductVisualOptions } from "@/lib/productImagery";

export const DEMO_PRESETS: DemoPreset[] = [
  {
    id: "eco-hydration",
    label: "Eco-Smart Hydration Bottle",
    tagline: "UV-C self-cleaning smart flask",
    accentHex: "#06B6D4",
    brief: {
      productName: "LumaDrop Hydro",
      productDescription:
        "Self-cleaning UV-C smart insulated water bottle crafted from 100% recycled ocean-bound titanium. Features an ambient LED hydration glow ring, 24-hour cold lock, and zero-plastic filtration synced to your daily recovery goals.",
      targetAudience:
        "Eco-conscious urban athletes, remote founders, and wellness-driven Gen Z & Millennial commuters",
      brandTone: "Minimalist",
      platforms: ["Instagram", "LinkedIn", "Meta Ads"],
    },
  },
  {
    id: "ai-earbuds",
    label: "AI Noise-Canceling Earbuds",
    tagline: "Adaptive neural acoustic pods",
    accentHex: "#8B5CF6",
    brief: {
      productName: "Aether Pods Pro",
      productDescription:
        "Ultra-low-latency AI earbuds powered by real-time neural acoustic isolation. Automatically silences city transit roar while preserving human voices, with 42-hour battery life and spatial studio mastering.",
      targetAudience:
        "Creative directors, deep-work software engineers, frequent flyers, and audiophile creators",
      brandTone: "Bold",
      platforms: ["Instagram", "LinkedIn", "Meta Ads"],
    },
  },
  {
    id: "artisanal-matcha",
    label: "Artisanal Matcha Subscription",
    tagline: "First-harvest Uji ceremonial tins",
    accentHex: "#10B981",
    brief: {
      productName: "Kuroha Ceremonial",
      productDescription:
        "Single-cultivar first-harvest Uji matcha stone-milled to order in Kyoto and nitrogen-sealed within 24 hours. Delivered monthly with tasting notes, bamboo whisk care rituals, and jitter-free L-theanine focus.",
      targetAudience:
        "Specialty coffee converts, design-minded wellness rituals seekers, and luxury lifestyle subscribers",
      brandTone: "Luxury",
      platforms: ["Instagram", "LinkedIn", "Meta Ads"],
    },
  },
];

function detectMotif(brief: CampaignBrief): CreativeMotif {
  const haystack = `${brief.productName} ${brief.productDescription}`.toLowerCase();
  if (
    haystack.includes("bottle") ||
    haystack.includes("hydro") ||
    haystack.includes("water") ||
    haystack.includes("hydration")
  ) {
    return "bottle";
  }
  if (
    haystack.includes("earbud") ||
    haystack.includes("audio") ||
    haystack.includes("noise") ||
    haystack.includes("aether") ||
    haystack.includes("sound")
  ) {
    return "earbuds";
  }
  if (
    haystack.includes("matcha") ||
    haystack.includes("tea") ||
    haystack.includes("kyoto") ||
    haystack.includes("kuroha")
  ) {
    return "matcha";
  }
  return "abstract";
}

function getTonePalette(motif: CreativeMotif, tone: BrandTone): ColorSwatch[] {
  if (motif === "bottle") {
    return [
      { name: "Obsidian Matte", hex: "#0B0E14", role: "Primary Canvas" },
      { name: "Glacial Cyan", hex: "#06B6D4", role: "UV-C Glow Accent" },
      { name: "Deep Abyss", hex: "#0E7490", role: "Secondary Gradient" },
      { name: "Ion Violet", hex: "#8B5CF6", role: "Telemetry Pulse" },
      { name: "Pure Mist", hex: "#E2F8FC", role: "Typography Highlight" },
    ];
  }
  if (motif === "earbuds") {
    return [
      { name: "Carbon Void", hex: "#09090E", role: "Studio Backdrop" },
      { name: "Electric Violet", hex: "#8B5CF6", role: "Neural Wave Core" },
      { name: "Pulse Cyan", hex: "#06B6D4", role: "Acoustic Rim Light" },
      { name: "Titanium Slate", hex: "#272736", role: "Hardware Surface" },
      { name: "Chrome White", hex: "#F4F4F8", role: "Hero Display Type" },
    ];
  }
  if (motif === "matcha") {
    return [
      { name: "Kyoto Ink", hex: "#0B100D", role: "Editorial Ground" },
      { name: "Ceremonial Jade", hex: "#10B981", role: "Cultivar Essence" },
      { name: "Uji Emerald", hex: "#047857", role: "Shadow Midtone" },
      { name: "Warm Gold Leaf", hex: "#D4AF37", role: "Luxury Seal Accent" },
      { name: "Washi Ivory", hex: "#F3F1E7", role: "Serif & Body Ink" },
    ];
  }

  const toneMap: Record<BrandTone, ColorSwatch[]> = {
    Bold: [
      { name: "Obsidian Core", hex: "#09090B", role: "Primary Ground" },
      { name: "Electric Violet", hex: "#8B5CF6", role: "Hero Accent" },
      { name: "Hyper Cyan", hex: "#06B6D4", role: "Secondary Highlight" },
      { name: "Kinetic Rose", hex: "#F43F5E", role: "CTA Energy" },
      { name: "Crisp Alabaster", hex: "#F8FAFC", role: "Headline Copy" },
    ],
    Minimalist: [
      { name: "Graphite Ink", hex: "#0C0C0F", role: "Canvas Base" },
      { name: "Signal Cyan", hex: "#06B6D4", role: "Precision Accent" },
      { name: "Muted Violet", hex: "#7C3AED", role: "Depth Layer" },
      { name: "Architectural Mist", hex: "#94A3B8", role: "Secondary Metadata" },
      { name: "Pure Studio", hex: "#FFFFFF", role: "Primary Text" },
    ],
    Luxury: [
      { name: "Noir Velvet", hex: "#09080C", role: "Primary Backdrop" },
      { name: "Royal Amethyst", hex: "#8B5CF6", role: "Signature Aura" },
      { name: "Champagne Gold", hex: "#EAB308", role: "Metallic Detail" },
      { name: "Smoke Slate", hex: "#1F1D2B", role: "Elevated Surface" },
      { name: "Silk Pearl", hex: "#F5F3EE", role: "Editorial Serif" },
    ],
    Playful: [
      { name: "Midnight Pop", hex: "#0B0A14", role: "Contrast Stage" },
      { name: "Neon Violet", hex: "#A855F7", role: "Primary Spark" },
      { name: "Aqua Fizz", hex: "#06B6D4", role: "Secondary Pop" },
      { name: "Solar Coral", hex: "#FB7185", role: "Playful Accent" },
      { name: "Cloud Bright", hex: "#FAFAFA", role: "Display Type" },
    ],
  };

  return toneMap[tone];
}

export function getMockCampaignAssets(
  brief: CampaignBrief,
  campaignId: string = "camp_preview"
): CampaignAssets {
  return buildSimulatedCampaignAssets(brief, campaignId);
}

export function buildSimulatedCampaignAssets(
  brief: CampaignBrief,
  campaignId: string
): CampaignAssets {
  const motif = detectMotif(brief);
  const palette = getTonePalette(motif, brief.brandTone);
  const primaryHex = palette[1]?.hex ?? "#8B5CF6";
  const secondaryHex = palette[2]?.hex ?? "#06B6D4";
  const accentHex = palette[3]?.hex ?? "#06B6D4";
  const bgHex = palette[0]?.hex ?? "#09090B";

  const product = brief.productName.trim() || "Untitled Product";
  const audience = brief.targetAudience.trim() || "modern digital consumers";
  const tone = brief.brandTone;

  const headlineSets: Record<CreativeMotif, [string, string, string]> = {
    bottle: [
      "PURE HYDRATION. ZERO PLASTIC.",
      "LIGHT THAT PURIFIES EVERY SIP",
      "ENGINEERED FOR DAILY RECOVERY",
    ],
    earbuds: [
      "SILENCE THE NOISE. HEAR GENIUS.",
      "NEURAL ACOUSTICS IN MOTION",
      "42 HOURS OF DEEP FLOW STATE",
    ],
    matcha: [
      "STONE-MILLED IN UJI. POURED FRESH.",
      "CALM FOCUS WITHOUT THE CRASH",
      "FIRST HARVEST RITUAL, DELIVERED",
    ],
    abstract: [
      `${product.toUpperCase()} REIMAGINED.`,
      `CRAFTED FOR ${tone.toUpperCase()} IMPACT`,
      "BUILT TO STAND OUT EVERYWHERE",
    ],
  };

  const [h1, h2, h3] = headlineSets[motif];

  const art1 = generateCreativeSvg({
    brandName: product,
    headline: h1,
    subline: `${tone} campaign direction tailored for ${audience.slice(0, 44)}`,
    badge: "HERO KEY VISUAL · 4:5",
    primaryHex,
    secondaryHex,
    accentHex,
    bgHex,
    motif,
    variant: 0,
  });

  const art2 = generateCreativeSvg({
    brandName: product,
    headline: h2,
    subline: "Macro rim lighting + precision typography for high-converting paid feeds",
    badge: "META AD HERO · 1:1",
    primaryHex: secondaryHex,
    secondaryHex: primaryHex,
    accentHex,
    bgHex,
    motif,
    variant: 1,
  });

  const art3 = generateCreativeSvg({
    brandName: product,
    headline: h3,
    subline: "Executive editorial frame built for thought-leadership & product launches",
    badge: "LINKEDIN SPOTLIGHT · 16:9",
    primaryHex,
    secondaryHex: accentHex,
    accentHex: secondaryHex,
    bgHex,
    motif,
    variant: 2,
  });

  const visualOptions = getProductVisualOptions(brief, campaignId);
  const studioOpt = visualOptions[0] ?? {
    imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1400&q=85",
    lighting: "Dual-axis rim lighting with cool cyan bounce and obsidian negative space",
    composition: "Asymmetric rule-of-thirds split; tactile hardware silhouette anchored right",
  };
  const lifestyleOpt = visualOptions[1] ?? studioOpt;
  const macroOpt = visualOptions[2] ?? studioOpt;

  const creatives: VisualCreative[] = [
    {
      id: `${campaignId}-vis-1`,
      title: "Hero Key Visual — Studio Monolith",
      subtitle: "Primary Instagram Carousel Cover & Launch Poster",
      format: "4:5 Editorial Portrait",
      aspectRatio: "4:5",
      platform: "Instagram",
      imageUrl: studioOpt.imageUrl,
      options: visualOptions,
      lighting: studioOpt.lighting ?? "Dual-axis rim lighting with cool cyan bounce and obsidian negative space",
      composition: studioOpt.composition ?? "Asymmetric rule-of-thirds split; tactile hardware silhouette anchored right",
      artNote:
        "High-contrast chiaroscuro elevates perceived craftsmanship while leaving clean breathing room for bold kinetic display copy.",
      promptSummary: `Obsidian studio product photography of ${product}, dramatic ${primaryHex} and ${accentHex} rim glow, crisp editorial framing, ${tone.toLowerCase()} luxury finish.`,
    },
    {
      id: `${campaignId}-vis-2`,
      title: "Paid Conversion Frame — Spec Spotlight",
      subtitle: "Thumb-Stopping Meta Feed Creative",
      format: "1:1 Performance Square",
      aspectRatio: "1:1",
      platform: "Meta Ads",
      imageUrl: lifestyleOpt.imageUrl,
      options: visualOptions,
      lighting: lifestyleOpt.lighting ?? "Volumetric top key light with glowing accent halo around signature feature",
      composition: lifestyleOpt.composition ?? "Tight hero focus with micro-spec telemetry strip along bottom edge",
      artNote:
        "Designed to earn attention within 0.8 seconds on mobile feeds by pairing a luminous visual focal point with crisp typographic hierarchy.",
      promptSummary: `Close-up commercial campaign card for ${product}, luminous ${secondaryHex} atmosphere, micro-grid studio texture, high conversion visual clarity.`,
    },
    {
      id: `${campaignId}-vis-3`,
      title: "Editorial Widescreen — Brand Manifesto",
      subtitle: "LinkedIn Launch Banner & Case Study Header",
      format: "16:9 Widescreen Cinema",
      aspectRatio: "16:9",
      platform: "LinkedIn",
      imageUrl: macroOpt.imageUrl,
      options: visualOptions,
      lighting: macroOpt.lighting ?? "Soft architectural side-fill with subtle metallic sheen",
      composition: macroOpt.composition ?? "Panoramic layout balancing brand story headline and product proof",
      artNote:
        "Strips away ad clutter in favor of confident editorial restraint that resonates with decision-makers and design-literate buyers.",
      promptSummary: `Widescreen brand film still for ${product}, ${tone.toLowerCase()} design studio aesthetic, clean negative space, refined ${primaryHex} gradient accents.`,
    },
  ];

  const storyboard: StoryboardFrame[] = [
    {
      id: `${campaignId}-sb-1`,
      sceneNumber: 1,
      timecode: "00:00 – 00:03",
      durationSec: 3,
      title: "The Friction Hook",
      visualDirection: `Tight macro shot on everyday clutter fading into deep obsidian darkness as ${product} emerges through a crisp beam of ${primaryHex} light.`,
      cameraMove: "Slow 120fps push-in with shallow depth-of-field rack focus",
      audioCue: "Subtle low-pass ambient hum interrupted by a single crystalline chime",
      captionOverlay: h1,
      accentHex: primaryHex,
      secondaryHex,
    },
    {
      id: `${campaignId}-sb-2`,
      sceneNumber: 2,
      timecode: "00:03 – 00:07",
      durationSec: 4,
      title: "Signature Feature Reveal",
      visualDirection: `Orbital 360° studio sweep highlighting core craftsmanship and intelligent material detail illuminated by ${accentHex} rim highlights.`,
      cameraMove: "Robotic bolt-arm arc sweep synced to percussion hit",
      audioCue: "Crisp tactile click + rising synth arpeggio",
      captionOverlay: h2,
      accentHex,
      secondaryHex: primaryHex,
    },
    {
      id: `${campaignId}-sb-3`,
      sceneNumber: 3,
      timecode: "00:07 – 00:12",
      durationSec: 5,
      title: "In-World Proof",
      visualDirection: `Quick lifestyle cuts featuring ${audience.split(",")[0]} using ${product} seamlessly across morning studio, transit, and twilight sessions.`,
      cameraMove: "Match-cut whip pans aligned to product silhouette center",
      audioCue: "Warm rhythmic groove with authentic environmental Foley",
      captionOverlay: "DESIGNED FOR REAL RHYTHMS",
      accentHex: secondaryHex,
      secondaryHex: accentHex,
    },
    {
      id: `${campaignId}-sb-4`,
      sceneNumber: 4,
      timecode: "00:12 – 00:15",
      durationSec: 3,
      title: "End-Frame Conversion Lockup",
      visualDirection: `Centered monolith lockup of ${product} over obsidian grid with pulsing palette accent bar and clean CTA reveal.`,
      cameraMove: "Locked hero frame with gentle 2% scale drift",
      audioCue: "Resonant sonic logo resolve + soft reverb tail",
      captionOverlay: `EXPERIENCE ${product.toUpperCase()}`,
      accentHex: primaryHex,
      secondaryHex: accentHex,
    },
  ];

  const handoff: ContextHandoffPayload = {
    fromAgent: "@VisualAgent",
    toAgent: "@CopyAgent",
    visualConcept: `Obsidian chiaroscuro studio aesthetic paired with luminous ${primaryHex} highlights`,
    dominantMood: `${tone} · Precision-Crafted · Editorial Modern`,
    paletteHexes: palette.map((p) => p.hex),
    heroMotif:
      motif === "bottle"
        ? "Glowing UV-C halo ring around matte recycled titanium vessel"
        : motif === "earbuds"
          ? "Floating acoustic stems framed by concentric neural soundwave rings"
          : motif === "matcha"
            ? "Velvet jade crema swirl inside hand-thrown dark chawan ceramic"
            : `Sculptural geometric light-form representing ${product}`,
    messagingDirectives: [
      `Mirror the ${tone.toLowerCase()} visual restraint with punchy, zero-fluff opening hooks`,
      `Anchor copy around tangible daily upgrades for ${audience.split(",")[0].trim()}`,
      "Pair sensory visual cues (light, texture, precision) directly with conversion CTAs",
    ],
  };

  const socialPosts: SocialPost[] = [
    {
      id: `${campaignId}-ig-1`,
      platform: "Instagram",
      variantLabel: "Carousel Launch Post",
      hook: `${h1} Meet ${product}.`,
      body: `Most everyday essentials force a compromise between performance and design. We engineered ${product} so you never have to choose.\n\n${brief.productDescription}\n\nSwipe through to see every detail up close — from the first silhouette sketch to our final studio render.`,
      callToAction: "Tap the link in bio to reserve the first drop before allocation closes.",
      bestTimeToPost: "Tue & Thu · 6:30 PM local",
      estimatedEngagement: "6.4% – 8.2% ER",
    },
    {
      id: `${campaignId}-ig-2`,
      platform: "Instagram",
      variantLabel: "Reels / Storyboard Caption",
      hook: `Three seconds is all it takes to feel the difference.`,
      body: `Built for ${audience.toLowerCase()} who obsess over the small rituals that power great days. Watch the 15-second launch film and tell us which detail caught your eye first.`,
      callToAction: "Comment 'DROP' for early studio access & launch-week perks.",
      bestTimeToPost: "Wed & Sun · 11:30 AM local",
      estimatedEngagement: "9.1% Share Rate",
    },
    {
      id: `${campaignId}-li-1`,
      platform: "LinkedIn",
      variantLabel: "Founder Launch Story",
      hook: `Why we spent 14 months rethinking something you touch every single day.`,
      body: `When we started building ${product}, we noticed a gap: ${audience.toLowerCase()} were surrounded by noisy, disposable products that aged poorly.\n\nOur thesis was simple — combine relentless functional engineering with a ${tone.toLowerCase()}, timeless visual language.\n\nHere is what went into this release:\n• ${brief.productDescription.split(".")[0]}.\n• Art-directed around clean contrast and tactile utility.\n• Designed to earn a permanent place in your daily stack.\n\nToday, ${product} is officially live.`,
      callToAction: "Explore the full launch lookbook & technical breakdown in the comments.",
      bestTimeToPost: "Tue – Thu · 8:45 AM local",
      estimatedEngagement: "4.8% CTR",
    },
  ];

  const cleanDomain = product.toLowerCase().replace(/[^a-z0-9]/g, "") || "agentpixelate";

  const metaAds: MetaAdVariant[] = [
    {
      id: `${campaignId}-meta-1`,
      angle: "Hero Benefit · Direct Conversion",
      headline: `${product} — ${h1.slice(0, 34)}`,
      primaryText: `Upgrade your daily standard with ${product}. ${brief.productDescription.slice(0, 155)}... Built specifically for ${audience.split(",")[0].trim().toLowerCase()}.`,
      description: `${tone} design. Ships with 30-day studio guarantee.`,
      ctaLabel: "Shop Now",
      displayUrl: `${cleanDomain}.com/launch`,
      creativeIndex: 1,
    },
    {
      id: `${campaignId}-meta-2`,
      angle: "Curiosity Hook · Retargeting",
      headline: `Still settling for ordinary? Meet ${product}.`,
      primaryText: `Every detail of ${product} was art-directed and engineered to eliminate friction from your routine. See why early adopters are switching in record numbers.`,
      description: "Limited first-batch release · Free express shipping",
      ctaLabel: "Learn More",
      displayUrl: `${cleanDomain}.com/discover`,
      creativeIndex: 0,
    },
  ];

  const baseTag = product.replace(/[^a-zA-Z0-9]/g, "");
  const motifTags: Record<CreativeMotif, string[]> = {
    bottle: ["#SmartHydration", "#EcoDesign", "#UVCPure", "#ZeroPlastic", "#DailyRecovery"],
    earbuds: ["#NeuralAudio", "#DeepWork", "#SpatialSound", "#NoiseCanceling", "#CreatorGear"],
    matcha: ["#UjiMatcha", "#CeremonialGrade", "#CalmFocus", "#KyotoCraft", "#MatchaRitual"],
    abstract: ["#DesignForward", "#ModernCraft", "#ProductLaunch", "#CreativeStudio", "#NextGen"],
  };

  const hashtags = [
    `#${baseTag}`,
    ...motifTags[motif],
    `#${tone}Design`,
    "#AgentPixelate",
  ];

  return {
    campaignId,
    generatedAt: new Date().toISOString(),
    brief,
    artDirectionSummary: `${tone} Obsidian-canvas visual language pairing high-contrast macro lighting (${primaryHex} & ${accentHex}) with crisp editorial copy engineered for ${audience}.`,
    palette,
    creatives,
    videos: [],
    storyboard,
    handoff,
    socialPosts,
    metaAds,
    hashtags,
  };
}
