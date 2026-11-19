import { CampaignBrief, VisualOption, VisualStyle } from "@/types/campaign";

export interface ProductVisualSet {
  category: string;
  options: VisualOption[];
}

interface CategoryTemplate {
  keywords: string[];
  options: {
    label: string;
    style: VisualStyle;
    imageUrl: string;
    description: string;
    lighting: string;
    composition: string;
  }[];
}

const CATEGORY_TEMPLATES: Record<string, CategoryTemplate> = {
  hydration_bottle: {
    keywords: ["bottle", "hydro", "water", "flask", "tumbler", "drinkware", "hydration", "titanium"],
    options: [
      {
        label: "Studio Monolith",
        style: "studio",
        imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1400&q=85",
        description: "Minimalist titanium vacuum flask floating on dark obsidian slate with soft rim glow.",
        lighting: "Dual-axis rim light with cyan bounce and specular highlight on metallic seam",
        composition: "Centered packshot with 20% negative breathing space and subtle reflection",
      },
      {
        label: "Lifestyle In-Situ",
        style: "lifestyle",
        imageUrl: "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=1400&q=85",
        description: "Hydration flask positioned in active urban runner and commuter setting.",
        lighting: "Warm natural daylight with soft directional sun flare",
        composition: "Rule-of-thirds environmental framing with dynamic depth of field",
      },
      {
        label: "Macro Craftsmanship",
        style: "macro",
        imageUrl: "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1400&q=85",
        description: "Extreme tactile macro detailing lid texture, silicone grip, and condensation beads.",
        lighting: "Precision micro-spotlight highlighting brushed metal grain",
        composition: "Tight 45° angled crop emphasizing premium hardware craftsmanship",
      },
      {
        label: "Dark Editorial",
        style: "editorial",
        imageUrl: "https://images.unsplash.com/photo-1589365278144-c9e705f843ba?auto=format&fit=crop&w=1400&q=85",
        description: "High-contrast chiaroscuro luxury campaign aesthetic with deep cinematic shadows.",
        lighting: "Dramatic single-source overhead key light with deep black shadows",
        composition: "Asymmetric silhouette anchored right with kinetic display copy space",
      },
    ],
  },
  audio_earbuds: {
    keywords: ["earbud", "audio", "noise", "headphone", "sound", "acoustic", "pod", "music", "aether"],
    options: [
      {
        label: "Studio Monolith",
        style: "studio",
        imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=1400&q=85",
        description: "Matte obsidian acoustic pods resting in open charging case on dark slate.",
        lighting: "Studio softbox overhead with dual edge rim glow on ear tip contours",
        composition: "Geometric top-three-quarters isolation with deep pedestal shadow",
      },
      {
        label: "Lifestyle In-Situ",
        style: "lifestyle",
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1400&q=85",
        description: "Immersive deep-work focus state with premium audiophile acoustics in city setting.",
        lighting: "Moody neon atmospheric backlight with warm front key fill",
        composition: "Candid lifestyle portrait emphasizing seamless ergonomic in-ear fit",
      },
      {
        label: "Macro Craftsmanship",
        style: "macro",
        imageUrl: "https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?auto=format&fit=crop&w=1400&q=85",
        description: "Ultra-close macro view of acoustic mic mesh, touch sensors, and titanium ring.",
        lighting: "Micro-diffused fiber-optic rim illuminating fine sound port apertures",
        composition: "Extreme diagonal macro highlighting microscopic acoustic engineering",
      },
      {
        label: "Dark Editorial",
        style: "editorial",
        imageUrl: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=1400&q=85",
        description: "Futuristic dark-mode editorial campaign framing bold industrial audio hardware.",
        lighting: "Cold cyan and violet split lighting with high contrast ratios",
        composition: "Floating hardware levitation over liquid dark reflection",
      },
    ],
  },
  matcha_tea: {
    keywords: ["matcha", "tea", "kyoto", "ceremonial", "kuroha", "whisk", "chasen", "chawan", "herbal"],
    options: [
      {
        label: "Studio Monolith",
        style: "studio",
        imageUrl: "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=1400&q=85",
        description: "Ceremonial jade matcha bowl with traditional bamboo chasen whisk on minimalist stone.",
        lighting: "Soft diffuse studio daylight with gentle warmth on ceramic glaze",
        composition: "Balanced zen composition with artisanal bowl and whisk alignment",
      },
      {
        label: "Lifestyle In-Situ",
        style: "lifestyle",
        imageUrl: "https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=1400&q=85",
        description: "Serene morning pouring ritual featuring creamy emerald green matcha foam.",
        lighting: "Organic morning sun streaming across wooden counter with natural shadows",
        composition: "Overhead artisanal flat-lay capturing authentic preparation gesture",
      },
      {
        label: "Macro Craftsmanship",
        style: "macro",
        imageUrl: "https://images.unsplash.com/photo-1515823662273-ad9525e58846?auto=format&fit=crop&w=1400&q=85",
        description: "Macro texture of stone-milled first-harvest Uji ceremonial powder granules.",
        lighting: "Raking side light revealing fine micro-milled velvet powder texture",
        composition: "Extreme textured close-up with intense emerald green contrast",
      },
      {
        label: "Dark Editorial",
        style: "editorial",
        imageUrl: "https://images.unsplash.com/photo-1582793988951-9aed5509eb97?auto=format&fit=crop&w=1400&q=85",
        description: "Dark moody Japanese aesthetic with rising steam and matte black stoneware.",
        lighting: "Chiaroscuro rim light catching rising vapor against dark charcoal background",
        composition: "Minimalist Japanese negative space with single focal ceramic vessel",
      },
    ],
  },
  wearable_tech: {
    keywords: ["watch", "ring", "wearable", "biometric", "tracker", "fitness", "smartwatch", "sensor", "oled"],
    options: [
      {
        label: "Studio Monolith",
        style: "studio",
        imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1400&q=85",
        description: "Sleek biometric smartwatch hovering over matte dark pedestal with glowing display.",
        lighting: "Precision studio strip lighting tracing curved glass bevels",
        composition: "Dynamic 3/4 floating perspective with sharp OLED interface focus",
      },
      {
        label: "Lifestyle In-Situ",
        style: "lifestyle",
        imageUrl: "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=1400&q=85",
        description: "Biometric wearable in athletic motion tracking heart rate and recovery metrics.",
        lighting: "Golden hour sunset rim lighting on athlete wrist",
        composition: "Kinetic action shot with shallow depth of field on watch dial",
      },
      {
        label: "Macro Craftsmanship",
        style: "macro",
        imageUrl: "https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=1400&q=85",
        description: "Extreme close-up on titanium chassis, knurled digital crown, and sensor cluster.",
        lighting: "Micro-spotlight highlighting precision CNC machined bevels",
        composition: "Macro diagonal split showcasing aerospace-grade titanium finish",
      },
      {
        label: "Dark Editorial",
        style: "editorial",
        imageUrl: "https://images.unsplash.com/photo-1510519138197-06b8628cbf47?auto=format&fit=crop&w=1400&q=85",
        description: "Cyberpunk dark-room aesthetic with glowing cyan telemetry reflection.",
        lighting: "Deep contrast with neon telemetry reflections",
        composition: "Architectural silhouette framed against dark obsidian mirrors",
      },
    ],
  },
  skincare_beauty: {
    keywords: ["serum", "cream", "skin", "cosmetic", "perfume", "beauty", "fragrance", "glow", "lotion", "wellness"],
    options: [
      {
        label: "Studio Monolith",
        style: "studio",
        imageUrl: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1400&q=85",
        description: "Frosted glass dropper bottle resting on organic stone with natural botanical textures.",
        lighting: "Soft diffuse studio beauty dish with subtle warm rim",
        composition: "Statuesque vertical bottle placement with elegant negative balance",
      },
      {
        label: "Lifestyle In-Situ",
        style: "lifestyle",
        imageUrl: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1400&q=85",
        description: "Morning skincare application ritual with natural dew and glowing skin textures.",
        lighting: "Warm morning bathroom window light with soft bounce",
        composition: "Intimate lifestyle perspective focusing on sensory ritual",
      },
      {
        label: "Macro Craftsmanship",
        style: "macro",
        imageUrl: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=1400&q=85",
        description: "Suspended droplet of hydrating active serum reflecting clear optical refractions.",
        lighting: "Backlit macro flash freezing viscous liquid droplet in motion",
        composition: "Ultra-sharp macro close-up celebrating formulation purity",
      },
      {
        label: "Dark Editorial",
        style: "editorial",
        imageUrl: "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=1400&q=85",
        description: "Luxury dark noir fragrance presentation with liquid obsidian ripples.",
        lighting: "Chiaroscuro single key light with crystal glass refraction",
        composition: "High-fashion luxury editorial framing with dramatic contrast",
      },
    ],
  },
  coffee_beverage: {
    keywords: ["coffee", "espresso", "roast", "beans", "brew", "cafe", "latte", "barista", "beverage"],
    options: [
      {
        label: "Studio Monolith",
        style: "studio",
        imageUrl: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1400&q=85",
        description: "Single-origin pour-over carafe and custom ceramic mug on dark slate.",
        lighting: "Balanced studio softbox with warm tungsten accent",
        composition: "Geometric pour-over setup with minimalist industrial styling",
      },
      {
        label: "Lifestyle In-Situ",
        style: "lifestyle",
        imageUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1400&q=85",
        description: "Barista pouring velvety microfoam latte art in boutique coffee bar.",
        lighting: "Warm café ambiance with natural daylight spill",
        composition: "Dynamic pouring action frozen mid-flow with rich crema detail",
      },
      {
        label: "Macro Craftsmanship",
        style: "macro",
        imageUrl: "https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=1400&q=85",
        description: "Freshly roasted single-origin whole coffee beans glistening with natural oils.",
        lighting: "Low-angle raking light highlighting roasted fissures and sheen",
        composition: "Textured macro field with shallow depth and warm caramel tones",
      },
      {
        label: "Dark Editorial",
        style: "editorial",
        imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1400&q=85",
        description: "Moody dark espresso extraction with steam and deep golden crema.",
        lighting: "Dramatic rim lighting on porcelain cup against deep charcoal backdrop",
        composition: "Atmospheric editorial shot with subtle rising vapor",
      },
    ],
  },
  footwear_apparel: {
    keywords: ["shoe", "sneaker", "footwear", "apparel", "jacket", "hoodie", "clothing", "wear", "outfit"],
    options: [
      {
        label: "Studio Monolith",
        style: "studio",
        imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1400&q=85",
        description: "Bold performance sneaker packshot isolated on clean background with dramatic shadow.",
        lighting: "Dual directional studio strobes with crisp rim definition",
        composition: "Dynamic 45° profile showing midsole cushioning and silhouette",
      },
      {
        label: "Lifestyle In-Situ",
        style: "lifestyle",
        imageUrl: "https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=1400&q=85",
        description: "Urban street style action snapshot in city environment during golden hour.",
        lighting: "Low golden-hour sunlight creating long shadows on concrete",
        composition: "Kinetic street-level angle capturing movement and posture",
      },
      {
        label: "Macro Craftsmanship",
        style: "macro",
        imageUrl: "https://images.unsplash.com/photo-1607522370275-f14206abe5d3?auto=format&fit=crop&w=1400&q=85",
        description: "Extreme close-up on breathable knit weave, reinforced eyelets, and stitching.",
        lighting: "Precision macro light revealing microscopic fabric mesh",
        composition: "Close-in diagonal crop highlighting engineered textile durability",
      },
      {
        label: "Dark Editorial",
        style: "editorial",
        imageUrl: "https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111?auto=format&fit=crop&w=1400&q=85",
        description: "High-contrast monochrome editorial campaign with wet asphalt reflection.",
        lighting: "Chiaroscuro wet reflection lighting with dramatic edge flare",
        composition: "Bold editorial framing with high-energy negative space",
      },
    ],
  },
  tech_hardware: {
    keywords: ["keyboard", "mouse", "laptop", "computer", "desk", "monitor", "gadget", "charger", "hardware"],
    options: [
      {
        label: "Studio Monolith",
        style: "studio",
        imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1400&q=85",
        description: "Custom mechanical keyboard with subtle ambient underglow on matte desk pad.",
        lighting: "Studio softbox with soft ambient neon perimeter glow",
        composition: "Clean isometric studio view with sharp keycap legend focus",
      },
      {
        label: "Lifestyle In-Situ",
        style: "lifestyle",
        imageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1400&q=85",
        description: "Product in sleek modern creative studio desk setup with ambient light.",
        lighting: "Warm tungsten desk lamp balanced with cool screen backlighting",
        composition: "Authentic over-the-shoulder creator workspace perspective",
      },
      {
        label: "Macro Craftsmanship",
        style: "macro",
        imageUrl: "https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=1400&q=85",
        description: "Macro detailing PBT keycap texture, mechanical switch stem, and CNC aluminum plate.",
        lighting: "Micro-spotlight glancing across brushed aluminum chamfer",
        composition: "Extreme macro crop revealing industrial precision machining",
      },
      {
        label: "Dark Editorial",
        style: "editorial",
        imageUrl: "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=1400&q=85",
        description: "Obsidian futuristic technology showcase with deep carbon fiber textures.",
        lighting: "Cyberpunk high-contrast rim light cutting through dark shadows",
        composition: "Minimalist dark hardware silhouette with cinematic mystery",
      },
    ],
  },
  general_luxury: {
    keywords: [],
    options: [
      {
        label: "Studio Monolith",
        style: "studio",
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1400&q=85",
        description: "Premium product packshot resting on dark pedestal with sculpted rim light.",
        lighting: "Dual softbox studio rim with deep obsidian ground contrast",
        composition: "Centered product isolation with 20% negative breathing space",
      },
      {
        label: "Lifestyle In-Situ",
        style: "lifestyle",
        imageUrl: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=1400&q=85",
        description: "Real-world lifestyle moment capturing authentic everyday user interaction.",
        lighting: "Soft ambient natural daylight with gentle organic shadows",
        composition: "Rule-of-thirds environmental storytelling with rich depth",
      },
      {
        label: "Macro Craftsmanship",
        style: "macro",
        imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1400&q=85",
        description: "Tactile close-up highlighting premium material textures and fine tolerances.",
        lighting: "Precision micro-spotlight illuminating micro-texture details",
        composition: "Tight 45° macro crop celebrating craftsmanship and finish",
      },
      {
        label: "Dark Editorial",
        style: "editorial",
        imageUrl: "https://images.unsplash.com/photo-1510519138197-06b8628cbf47?auto=format&fit=crop&w=1400&q=85",
        description: "High-contrast dark-mode editorial campaign framing with cinematic shadows.",
        lighting: "Dramatic single-key overhead light with high contrast ratios",
        composition: "Bold asymmetric composition designed for thumb-stopping ads",
      },
    ],
  },
};

export function detectProductCategory(brief: CampaignBrief): string {
  const haystack = `${brief.productName} ${brief.productDescription}`.toLowerCase();
  for (const [category, template] of Object.entries(CATEGORY_TEMPLATES)) {
    if (template.keywords.some((kw) => haystack.includes(kw))) {
      return category;
    }
  }
  return "general_luxury";
}

export function getProductVisualOptions(
  brief: CampaignBrief,
  campaignId: string
): VisualOption[] {
  const category = detectProductCategory(brief);
  const template = CATEGORY_TEMPLATES[category] ?? CATEGORY_TEMPLATES.general_luxury;

  return template.options.map((opt, idx) => ({
    id: `${campaignId}-opt-${idx + 1}-${opt.style}`,
    label: opt.label,
    style: opt.style,
    imageUrl: opt.imageUrl,
    description: opt.description,
    lighting: opt.lighting,
    composition: opt.composition,
  }));
}
