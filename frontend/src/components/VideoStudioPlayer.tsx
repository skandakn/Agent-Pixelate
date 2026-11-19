"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Mic,
  Monitor,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Smartphone,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Tv,
  User,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  CampaignBrief,
  CampaignVideoAsset,
  CharacterAvatarId,
  CharacterPosition,
  ColorSwatch,
  StoryboardFrame,
  VideoAspectRatio,
  VideoShotStyle,
  VisualCreative,
} from "@/types/campaign";
import { cn, slugify } from "@/lib/utils";
import {
  CHARACTER_AVATARS,
  CharacterRenderState,
  drawCharacterAvatar,
} from "@/lib/characterAnimation";

const SHOT_RECIPES: {
  id: VideoShotStyle;
  label: string;
  curve: string;
  tag: string;
}[] = [
  {
    id: "obsidian_cinema",
    label: "Obsidian Cinema",
    curve: "softLand · 24fps",
    tag: "bang-motion",
  },
  {
    id: "kinetic_type",
    label: "Kinetic Type",
    curve: "snapSettle · -0.045em",
    tag: "motionmaxxing",
  },
  {
    id: "luxury_editorial",
    label: "Luxury Editorial",
    curve: "velvetDrift · Gold",
    tag: "lemo-opuscar",
  },
  {
    id: "pulse_drop",
    label: "Pulse Drop",
    curve: "whipPush · 124 BPM",
    tag: "video-shotcraft",
  },
  {
    id: "vox_collage",
    label: "Vox Collage",
    curve: "halftone · Cutout",
    tag: "vox-director",
  },
  {
    id: "ink_press",
    label: "Ink Press",
    curve: "pressStamp · Swiss",
    tag: "video-shotcraft",
  },
  {
    id: "cyberpunk_neon",
    label: "Cyberpunk Neon",
    curve: "anamorphic · 2.39:1",
    tag: "video-shotcraft",
  },
  {
    id: "golden_hour_film",
    label: "Golden Hour 35mm",
    curve: "halation · 3200K",
    tag: "lemo-opuscar",
  },
  {
    id: "titanium_minimal",
    label: "Titanium Keynote",
    curve: "specular · 24fps",
    tag: "bang-motion",
  },
];

const DIRECTOR_BEATS = [
  { beat: "01", window: "0.0–2.0s", label: "Hook Wipe", move: "Masked baseline reveal" },
  { beat: "02", window: "2.0–4.2s", label: "Visual Proof", move: "Ken Burns 1.0→1.14x" },
  { beat: "03", window: "4.2–6.2s", label: "Brand World", move: "Palette swatch rail" },
  { beat: "04", window: "6.2–8.0s", label: "CTA Lockup", move: "Beat-synced pulse" },
];

const VOICEOVER_PRESETS: {
  id: "auto" | "zira" | "david" | "aria";
  label: string;
  tag: string;
  desc: string;
}[] = [
  {
    id: "auto",
    label: "Adaptive Auto",
    tag: "Tone Matched",
    desc: "Auto-selects vocal persona tailored to product story",
  },
  {
    id: "zira",
    label: "Sophia // Warm Host",
    tag: "Editorial",
    desc: "Nuanced, conversational lifestyle YouTube presenter",
  },
  {
    id: "david",
    label: "Marcus // Tech Lead",
    tag: "Authoritative",
    desc: "Resonant, high-credibility hardware reviewer",
  },
  {
    id: "aria",
    label: "Emma // YouTube Creator",
    tag: "High Energy",
    desc: "Dynamic, fast-paced YouTube unboxing cadence",
  },
];

interface VideoStudioPlayerProps {
  campaignId: string | null;
  brief: CampaignBrief;
  palette?: ColorSwatch[];
  videos: CampaignVideoAsset[];
  creatives?: VisualCreative[];
  storyboard?: StoryboardFrame[];
  isLiveBackend: boolean;
  isRenderingCut: boolean;
  renderError: string | null;
  onRenderCustomCut: (
    aspectRatio: VideoAspectRatio,
    shotStyle: VideoShotStyle,
    voiceoverOptions?: {
      enableVoiceover?: boolean;
      voice?: string;
      voiceoverScript?: string;
      enableCharacter?: boolean;
      characterAvatar?: CharacterAvatarId;
      characterPosition?: CharacterPosition;
    }
  ) => void;
}

function easeSoftLand(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - c, 4);
}

export function VideoStudioPlayer({
  campaignId,
  brief,
  videos,
  creatives = [],
  isLiveBackend,
  isRenderingCut,
  renderError,
  onRenderCustomCut,
}: VideoStudioPlayerProps) {
  const [aspectRatio, setAspectRatio] = useState<VideoAspectRatio>("16:9");
  const [shotStyle, setShotStyle] = useState<VideoShotStyle>("obsidian_cinema");
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [isPlayingCanvas, setIsPlayingCanvas] = useState(true);
  const [isRecordingWebm, setIsRecordingWebm] = useState(false);

  // YouTube Player Shell State
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [likeCount, setLikeCount] = useState(48200);
  const [showCaptions, setShowCaptions] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);

  // Character Animation & Viseme Presenter State (LatentSync & TalkCraft)
  const [enableCharacter, setEnableCharacter] = useState(true);
  const [selectedAvatar, setSelectedAvatar] = useState<CharacterAvatarId>("maya");
  const [characterPosition, setCharacterPosition] = useState<CharacterPosition>("pip_bottom_right");

  // Voiceover & Soundstage State
  const [enableVoiceover, setEnableVoiceover] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState<"auto" | "zira" | "david" | "aria">("auto");
  const [showScriptDrawer, setShowScriptDrawer] = useState(false);
  const [isAuditioning, setIsAuditioning] = useState(false);

  const durationMs = 8000;

  const defaultVoiceoverScript = useMemo(() => {
    const brand = brief.productName.trim();
    const firstSentence =
      brief.productDescription.split(/[.!?]/)[0]?.trim() || `${brand} is here`;
    const words = brief.productDescription.trim().split(/\s+/);
    const shortDesc = words.slice(0, 14).join(" ").replace(/[.,!?]+$/, "");
    const aud = brief.targetAudience.trim().slice(0, 48);
    const tone = brief.brandTone.toLowerCase();
    const cta = tone.includes("lux") ? "Discover the collection" : "Shop the drop";
    return `Introducing ${brand}. ${firstSentence}. ${shortDesc}. Built for ${aud}. Experience ${brand}. ${cta} today.`;
  }, [brief]);

  const [voiceoverScript, setVoiceoverScript] = useState("");
  const effectiveScript = voiceoverScript.trim() || defaultVoiceoverScript;

  // Real Web Speech API Narration Player
  const startSpeechNarration = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (!enableVoiceover || isMuted) return;

    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(effectiveScript);
    const voices = window.speechSynthesis.getVoices();

    if (
      selectedVoice === "david" ||
      (selectedVoice === "auto" &&
        ["bold", "tech", "pulse", "athletic"].some((k) =>
          brief.brandTone.toLowerCase().includes(k)
        ))
    ) {
      const male = voices.find(
        (v) =>
          v.name.toLowerCase().includes("david") ||
          v.name.toLowerCase().includes("male") ||
          v.name.toLowerCase().includes("guy")
      );
      if (male) utter.voice = male;
      utter.pitch = 0.95;
    } else {
      const female = voices.find(
        (v) =>
          v.name.toLowerCase().includes("zira") ||
          v.name.toLowerCase().includes("female") ||
          v.name.toLowerCase().includes("aria") ||
          v.name.toLowerCase().includes("samantha")
      );
      if (female) utter.voice = female;
      utter.pitch = 1.05;
    }

    utter.rate = playbackSpeed;
    utter.volume = volume;

    utter.onend = () => setIsAuditioning(false);
    utter.onerror = () => setIsAuditioning(false);

    window.speechSynthesis.speak(utter);
  }, [effectiveScript, enableVoiceover, isMuted, playbackSpeed, selectedVoice, volume, brief.brandTone]);

  const stopSpeechNarration = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsAuditioning(false);
    }
  }, []);

  const handleAuditionVoiceover = useCallback(() => {
    if (isAuditioning) {
      stopSpeechNarration();
    } else {
      setIsAuditioning(true);
      startSpeechNarration();
    }
  }, [isAuditioning, startSpeechNarration, stopSpeechNarration]);

  useEffect(() => {
    return () => {
      stopSpeechNarration();
    };
  }, [stopSpeechNarration]);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const heroImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const heroCreative = creatives[0];
    if (!heroCreative?.imageUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = heroCreative.imageUrl;
    img.onload = () => {
      heroImageRef.current = img;
    };
  }, [creatives]);

  // 60fps Cinema Engine Loop with Character Presenter and YouTube Overlays
  const drawFrame = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const progress = (timestamp % durationMs) / durationMs;
      setCurrentTimeSec(Math.round(progress * 8 * 10) / 10);
      const width = canvas.width;
      const height = canvas.height;

      // 1. Dark Theater Canvas Ground
      ctx.fillStyle = "#0A0D14";
      ctx.fillRect(0, 0, width, height);

      // 2. Ken Burns Hero Product Frame
      const hero = heroImageRef.current;
      if (hero && hero.complete && hero.naturalWidth > 0) {
        ctx.save();
        const kbScale = 1.0 + 0.14 * easeSoftLand(progress);
        const kbPanX = (progress - 0.5) * 22;
        const kbPanY = (progress - 0.5) * 14;

        ctx.translate(width / 2 + kbPanX, height / 2 + kbPanY);
        ctx.scale(kbScale, kbScale);
        ctx.translate(-width / 2, -height / 2);

        ctx.globalAlpha = 0.58;
        ctx.drawImage(hero, 0, 0, width, height);
        ctx.restore();
      }

      // 3. Radial Vignette & Atmospheric Halos
      const grad = ctx.createRadialGradient(
        width / 2,
        height / 2,
        width * 0.18,
        width / 2,
        height / 2,
        width * 0.72
      );
      grad.addColorStop(0, "rgba(0,0,0,0.12)");
      grad.addColorStop(1, "rgba(0,0,0,0.88)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 4. Advertising Typography & Beat Choreography
      ctx.save();
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Product Title
      const titleAlpha = easeSoftLand(Math.min(1, progress * 4.2));
      ctx.globalAlpha = titleAlpha;
      ctx.font = `900 ${Math.round(height * 0.084)}px Archivo, Impact, sans-serif`;
      ctx.fillText(brief.productName.toUpperCase(), width / 2, height * 0.36);

      // Beat Tagline
      const beatIndex = Math.min(
        DIRECTOR_BEATS.length - 1,
        Math.floor(progress * DIRECTOR_BEATS.length)
      );
      const activeBeat = DIRECTOR_BEATS[beatIndex];

      ctx.fillStyle = "#10B981";
      ctx.font = `700 ${Math.round(height * 0.036)}px 'JetBrains Mono', monospace`;
      ctx.fillText(
        `BEAT ${activeBeat.beat} // ${activeBeat.label.toUpperCase()}`,
        width / 2,
        height * 0.49
      );

      // Subtitle / Description Hook
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = `600 ${Math.round(height * 0.032)}px 'Hanken Grotesk', sans-serif`;
      const snippet =
        brief.productDescription.slice(0, 64) +
        (brief.productDescription.length > 64 ? "…" : "");
      ctx.fillText(snippet, width / 2, height * 0.58);

      // Film Gate Corner Brackets ⌜ ⌝ ⌞ ⌟
      const pad = Math.round(width * 0.038);
      const bLen = 16;
      ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // Top-Left
      ctx.moveTo(pad, pad + bLen); ctx.lineTo(pad, pad); ctx.lineTo(pad + bLen, pad);
      // Top-Right
      ctx.moveTo(width - pad - bLen, pad); ctx.lineTo(width - pad, pad); ctx.lineTo(width - pad, pad + bLen);
      // Bottom-Left
      ctx.moveTo(pad, height - pad - bLen); ctx.lineTo(pad, height - pad); ctx.lineTo(pad + bLen, height - pad);
      // Bottom-Right
      ctx.moveTo(width - pad - bLen, height - pad); ctx.lineTo(width - pad, height - pad); ctx.lineTo(width - pad, height - pad - bLen);
      ctx.stroke();

      // Optical Anamorphic Streak on Beat Transitions
      const localBeatProgress = (progress * DIRECTOR_BEATS.length) % 1;
      if (localBeatProgress < 0.2) {
        const flareIntensity = 1 - localBeatProgress / 0.2;
        ctx.save();
        ctx.strokeStyle = `rgba(6, 182, 212, ${(flareIntensity * 0.75).toFixed(2)})`;
        ctx.lineWidth = 2.5 * flareIntensity;
        ctx.beginPath();
        ctx.moveTo(0, height * 0.49);
        ctx.lineTo(width, height * 0.49);
        ctx.stroke();
        ctx.restore();
      }

      // 5. YouTube Synchronized Subtitles (with yellow styling)
      if (showCaptions && enableVoiceover) {
        ctx.save();
        const sentences = effectiveScript.split(/[.!?]/).filter((s) => s.trim());
        const currentSentence =
          sentences[beatIndex % sentences.length]?.trim() || effectiveScript.slice(0, 60);

        const subY = height - pad - 60;
        ctx.font = `600 ${Math.round(height * 0.03)}px 'Hanken Grotesk', sans-serif`;
        const metrics = ctx.measureText(currentSentence);
        const subW = metrics.width + 36;
        const subH = Math.round(height * 0.048);

        ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect((width - subW) / 2, subY, subW, subH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#FFDD00"; // Signature YouTube CC Yellow
        ctx.fillText(currentSentence, width / 2, subY + subH / 2);
        ctx.restore();
      }

      // 6. Live Audio Waveform Visualizer Bars (YouTube Music/Podcast Style)
      ctx.save();
      const numBars = 24;
      const barTotalW = width * 0.32;
      const barW = barTotalW / numBars - 2;
      const startX = width / 2 - barTotalW / 2;
      const barBaseY = height - pad - 12;

      for (let i = 0; i < numBars; i++) {
        const energy = Math.abs(
          Math.sin(timestamp * 0.008 + i * 0.4) * Math.cos(timestamp * 0.004 + i * 0.2)
        );
        const barH = 4 + energy * (height * 0.04);
        ctx.fillStyle = `rgba(16, 185, 129, ${(0.4 + energy * 0.6).toFixed(2)})`;
        ctx.fillRect(startX + i * (barW + 2), barBaseY - barH, barW, barH);
      }
      ctx.restore();

      // 7. Interactive Procedural Character Host Avatar (LatentSync & TalkCraft)
      if (enableCharacter) {
        const isSpeaking = isPlayingCanvas || isAuditioning;
        const audioEnergy = 0.5 + Math.sin(timestamp * 0.01) * 0.4;
        const charW = Math.round(width * 0.28);
        const charH = Math.round(height * 0.22);
        const charX =
          characterPosition === "pip_bottom_left"
            ? pad + 16
            : width - pad - charW - 16;
        const charY = height - pad - charH - 24;

        const charState: CharacterRenderState = {
          timeMs: timestamp,
          isSpeaking,
          audioEnergy,
          currentPhrase: activeBeat.label + " // " + brief.productName,
          avatarId: selectedAvatar,
          position: characterPosition,
        };

        drawCharacterAvatar(ctx, { x: charX, y: charY, width: charW, height: charH }, charState);
      }

      // 8. YouTube Video Scrub Line (Red Progress Bar at Bottom of Canvas)
      ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
      ctx.fillRect(0, height - 5, width, 5);
      ctx.fillStyle = "#FF0000"; // Signature YouTube Red
      ctx.fillRect(0, height - 5, width * progress, 5);

      // Red Seeker Knob
      ctx.fillStyle = "#FF0000";
      ctx.beginPath();
      ctx.arc(width * progress, height - 2.5, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      if (isPlayingCanvas) {
        animFrameRef.current = requestAnimationFrame(drawFrame);
      }
    },
    [
      brief,
      durationMs,
      effectiveScript,
      enableCharacter,
      enableVoiceover,
      isAuditioning,
      isPlayingCanvas,
      selectedAvatar,
      characterPosition,
      showCaptions,
    ]
  );

  useEffect(() => {
    if (isPlayingCanvas) {
      animFrameRef.current = requestAnimationFrame(drawFrame);
      startSpeechNarration();
    } else {
      stopSpeechNarration();
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawFrame, isPlayingCanvas, startSpeechNarration, stopSpeechNarration]);

  const togglePlayback = () => {
    setIsPlayingCanvas((prev) => !prev);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    setCurrentTimeSec(Math.round(pct * 8 * 10) / 10);
  };

  const handleRecordClientWebm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsRecordingWebm(true);
    try {
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${slugify(brief.productName)}-youtube-ad.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setIsRecordingWebm(false);
      };

      recorder.start();
      setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, 5000);
    } catch {
      setIsRecordingWebm(false);
    }
  };

  const activeVideo = videos[activeVideoIndex] ?? videos[0];

  return (
    <div className="space-y-4 font-sans">
      {/* 1. YouTube Video Studio Shell */}
      <div className="overflow-hidden rounded-xl border border-black/10 bg-[#0F0F12] text-white shadow-xl">
        {/* YouTube Top Bar Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#16161C] px-4 py-2.5">
          <div className="flex items-center gap-3">
            {/* Channel Avatar */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-[#FF0000] to-[#FF4E50] text-white shadow-md">
              <Play className="h-4 w-4 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm text-white">Agent Pixelate Studios</span>
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#10B981] text-[9px] font-black text-black">
                  ✓
                </span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/70">
                  Ad · 0:15
                </span>
              </div>
              <p className="font-mono text-[11px] text-white/50">1.48M subscribers • 124,580 views</p>
            </div>
          </div>

          {/* YouTube Interactive Actions */}
          <div className="flex items-center gap-2">
            {/* Subscribe Button */}
            <button
              type="button"
              onClick={() => setIsSubscribed((s) => !s)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold transition",
                isSubscribed
                  ? "bg-white/15 text-white hover:bg-white/25"
                  : "bg-[#FF0000] text-white hover:bg-[#CC0000]"
              )}
            >
              {isSubscribed ? (
                <>
                  <Bell className="h-3.5 w-3.5 fill-current" />
                  <span>Subscribed</span>
                </>
              ) : (
                <span>Subscribe</span>
              )}
            </button>

            {/* Like / Dislike */}
            <div className="flex items-center rounded-full bg-white/10 text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsLiked((l) => !l);
                  if (!isLiked) {
                    setIsDisliked(false);
                    setLikeCount((c) => c + 1);
                  } else {
                    setLikeCount((c) => c - 1);
                  }
                }}
                className={cn(
                  "flex items-center gap-1 rounded-l-full px-3 py-1 font-mono transition hover:bg-white/10",
                  isLiked && "text-[#10B981]"
                )}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                <span>{Math.round(likeCount / 1000)}K</span>
              </button>
              <div className="h-3.5 w-[1px] bg-white/20" />
              <button
                type="button"
                onClick={() => {
                  setIsDisliked((d) => !d);
                  if (!isDisliked) setIsLiked(false);
                }}
                className={cn(
                  "rounded-r-full px-2.5 py-1 transition hover:bg-white/10",
                  isDisliked && "text-red-400"
                )}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Visit Advertiser Link */}
            <a
              href="#order"
              onClick={(e) => {
                e.preventDefault();
                alert(`Redirecting to official ${brief.productName} promotional launch page.`);
              }}
              className="hidden sm:inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20 transition"
            >
              <span>Visit Advertiser</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Video Canvas Stage with YouTube Red Scrubber */}
        <div className="relative flex justify-center bg-black">
          {activeVideo ? (
            <video
              key={activeVideo.videoUrl}
              src={activeVideo.videoUrl}
              controls
              playsInline
              autoPlay
              loop
              muted={isMuted}
              className={cn(
                "border border-white/10 bg-black",
                activeVideo.aspectRatio === "9:16" ? "max-h-[460px] w-auto" : "aspect-video w-full"
              )}
            />
          ) : (
            <div className="relative w-full">
              <canvas
                ref={canvasRef}
                width={aspectRatio === "9:16" ? 720 : 1280}
                height={aspectRatio === "9:16" ? 1280 : 720}
                className={cn(
                  "cursor-pointer border border-white/10 bg-black",
                  aspectRatio === "9:16" ? "mx-auto max-h-[460px] w-auto" : "aspect-video w-full"
                )}
                onClick={togglePlayback}
              />

              {/* Top-Right YouTube Watermark */}
              <div className="pointer-events-none absolute top-3 right-4 flex items-center gap-1.5 rounded bg-black/60 px-2 py-0.5 font-mono text-[10px] text-white/80 backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                <span>4K 60FPS // YOUTUBE AD</span>
              </div>
            </div>
          )}
        </div>

        {/* YouTube Red Scrub Bar (Interactive) */}
        <div
          role="slider"
          aria-valuenow={currentTimeSec}
          aria-valuemin={0}
          aria-valuemax={8}
          tabIndex={0}
          onClick={handleSeek}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") setCurrentTimeSec((prev) => Math.min(8, prev + 1));
            if (e.key === "ArrowLeft") setCurrentTimeSec((prev) => Math.max(0, prev - 1));
          }}
          className="group relative h-1.5 w-full cursor-pointer bg-white/20 transition-all hover:h-2.5"
        >
          {/* Loaded Buffer Line */}
          <div className="absolute top-0 left-0 h-full w-[85%] bg-white/40" />
          {/* Active Red Progress Line */}
          <div
            className="absolute top-0 left-0 h-full bg-[#FF0000] transition-all"
            style={{ width: `${(currentTimeSec / 8) * 100}%` }}
          />
          {/* Seeker Knob */}
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-[#FF0000] shadow-md opacity-0 group-hover:opacity-100 transition"
            style={{ left: `calc(${(currentTimeSec / 8) * 100}% - 7px)` }}
          />
        </div>

        {/* YouTube Bottom Player Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#16161C] px-4 py-2 text-white">
          <div className="flex items-center gap-3">
            {/* Play / Pause */}
            <button
              type="button"
              onClick={togglePlayback}
              className="text-white hover:text-red-500 transition"
              title={isPlayingCanvas ? "Pause (Space)" : "Play (Space)"}
            >
              {isPlayingCanvas ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
            </button>

            {/* Replay 10s */}
            <button
              type="button"
              onClick={() => setCurrentTimeSec(0)}
              className="text-white/70 hover:text-white transition"
              title="Replay from start"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            {/* Volume + Mute */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsMuted((m) => !m)}
                className="text-white/80 hover:text-white transition"
              >
                {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  setIsMuted(false);
                }}
                className="h-1 w-16 cursor-pointer accent-[#FF0000]"
              />
            </div>

            {/* Time Stamp */}
            <span className="font-mono text-xs text-white/70">
              0:0{Math.floor(currentTimeSec)} / 0:08
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* [CC] Closed Captions Toggle */}
            <button
              type="button"
              onClick={() => setShowCaptions((c) => !c)}
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-xs font-bold transition",
                showCaptions ? "border-b-2 border-red-500 text-white" : "text-white/40 hover:text-white"
              )}
              title="Toggle YouTube Subtitles [CC]"
            >
              [CC]
            </button>

            {/* Character Presenter Toggle */}
            <button
              type="button"
              onClick={() => setEnableCharacter((c) => !c)}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-xs transition",
                enableCharacter
                  ? "border border-[#10B981] bg-[#10B981]/20 text-[#10B981]"
                  : "border border-white/20 text-white/50 hover:text-white"
              )}
            >
              <User className="h-3 w-3" />
              <span>Host: {enableCharacter ? selectedAvatar.toUpperCase() : "OFF"}</span>
            </button>

            {/* Settings Gear Pop-up */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSettingsMenu((s) => !s)}
                className="text-white/70 hover:text-white transition"
              >
                <Settings className="h-4 w-4" />
              </button>

              {showSettingsMenu && (
                <div className="absolute bottom-8 right-0 z-50 w-56 space-y-2 rounded-xl border border-white/20 bg-[#1F1F28] p-3 text-xs shadow-2xl">
                  <div className="border-b border-white/10 pb-1.5 font-bold uppercase text-white/70">
                    Player Settings
                  </div>

                  {/* Playback Speed */}
                  <div className="space-y-1">
                    <span className="text-[11px] text-white/50">Playback Speed</span>
                    <div className="grid grid-cols-4 gap-1 font-mono text-[10px]">
                      {[0.75, 1.0, 1.25, 1.5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setPlaybackSpeed(s);
                            setShowSettingsMenu(false);
                          }}
                          className={cn(
                            "rounded py-0.5 transition",
                            playbackSpeed === s ? "bg-[#FF0000] text-white font-bold" : "bg-white/10 text-white/70"
                          )}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Character Avatar Picker */}
                  <div className="space-y-1 pt-1">
                    <span className="text-[11px] text-white/50">Character Presenter</span>
                    <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
                      {(["maya", "leo", "aria", "pixel"] as CharacterAvatarId[]).map((av) => (
                        <button
                          key={av}
                          type="button"
                          onClick={() => {
                            setSelectedAvatar(av);
                            setEnableCharacter(true);
                          }}
                          className={cn(
                            "rounded py-0.5 uppercase transition",
                            selectedAvatar === av
                              ? "bg-[#10B981] text-black font-bold"
                              : "bg-white/10 text-white/70"
                          )}
                        >
                          {av}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Character Animation & AI Voiceover Studio Deck */}
      <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-2.5">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-[#10B981]" />
            <span className="text-xs font-semibold text-[#1D1D1F]">
              AI Character Presenter &amp; Latent Lip-Sync
            </span>
            <span className="rounded bg-[#E6F7EB] px-2 py-0.5 text-[10px] font-medium text-[#10B981]">
              Viseme Synced
            </span>
          </div>

          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setCharacterPosition("pip_bottom_right")}
              className={cn(
                "rounded-md border px-2.5 py-1 text-[11px] font-medium transition",
                characterPosition === "pip_bottom_right"
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
              )}
            >
              PiP Bottom-Right
            </button>
            <button
              type="button"
              onClick={() => setCharacterPosition("pip_bottom_left")}
              className={cn(
                "rounded-md border px-2.5 py-1 text-[11px] font-medium transition",
                characterPosition === "pip_bottom_left"
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
              )}
            >
              PiP Bottom-Left
            </button>
          </div>
        </div>

        {/* 4 Avatar Archetypes Grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.values(CHARACTER_AVATARS)).map((avatar) => {
            const active = selectedAvatar === avatar.id && enableCharacter;
            return (
              <button
                key={avatar.id}
                type="button"
                onClick={() => {
                  setSelectedAvatar(avatar.id);
                  setEnableCharacter(true);
                }}
                className={cn(
                  "rounded-lg border p-2.5 text-left transition",
                  active
                    ? "border-neutral-900 bg-[#F5F5F7] ring-1 ring-neutral-900 shadow-sm"
                    : "border-neutral-200 bg-white hover:bg-neutral-50"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate text-xs font-semibold text-[#1D1D1F]">{avatar.name}</span>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: avatar.themeColor }}
                  />
                </div>
                <div className="mt-0.5 line-clamp-1 text-[10px] text-neutral-500">{avatar.role}</div>
                <div className="mt-1 font-mono text-[9px] text-neutral-400">{avatar.accentBadge}</div>
              </button>
            );
          })}
        </div>

        {/* AI Voiceover & Narration Soundstage */}
        <div className="rounded-lg border border-neutral-100 bg-[#FBFBFD] p-3 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-neutral-700" />
              <span className="text-xs font-semibold text-[#1D1D1F]">
                AI Narration Voiceover
              </span>
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[9px] text-neutral-600">
                Web Speech Synced
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAuditionVoiceover}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition shadow-sm",
                  isAuditioning
                    ? "bg-[#D70015] text-white"
                    : "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                )}
              >
                {isAuditioning ? (
                  <>
                    <Square className="h-3 w-3 fill-current" />
                    <span>Stop Speech</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3 w-3" />
                    <span>Audition Voice</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowScriptDrawer((s) => !s)}
                className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 shadow-sm transition"
              >
                <FileText className="h-3 w-3" />
                <span>{showScriptDrawer ? "Hide Script" : "Edit Script"}</span>
              </button>
            </div>
          </div>

          {/* Voice Presets */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {VOICEOVER_PRESETS.map((vp) => {
              const active = selectedVoice === vp.id;
              return (
                <button
                  key={vp.id}
                  type="button"
                  onClick={() => setSelectedVoice(vp.id)}
                  className={cn(
                    "rounded-md border p-2 text-left transition",
                    active
                      ? "border-neutral-900 bg-white shadow-sm ring-1 ring-neutral-900"
                      : "border-neutral-200 bg-white hover:bg-neutral-50"
                  )}
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-[#1D1D1F]">
                    <span>{vp.label}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[10px] text-neutral-500">{vp.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Script Drawer */}
          {showScriptDrawer && (
            <div className="space-y-2 border-t border-neutral-200 pt-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-700">Voiceover Script</span>
                <button
                  type="button"
                  onClick={() => setVoiceoverScript("")}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-900"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  <span>Reset to AI default</span>
                </button>
              </div>
              <textarea
                rows={3}
                value={voiceoverScript || defaultVoiceoverScript}
                onChange={(e) => setVoiceoverScript(e.target.value)}
                className="w-full rounded-md border border-neutral-200 p-2 font-mono text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                placeholder="Enter narration script..."
              />
            </div>
          )}
        </div>

        {/* Render CTAs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2">
          <span className="font-mono text-xs text-neutral-500">
            {isLiveBackend && campaignId
              ? "FastAPI orchestrator renders beat-synced H.264 MP4 with FFmpeg & character overlays"
              : "60fps Canvas Kinetic Preview with WebM capture & synchronized voiceover"}
          </span>

          <div className="flex items-center gap-2">
            {isLiveBackend && campaignId ? (
              <button
                type="button"
                disabled={isRenderingCut}
                onClick={() =>
                  onRenderCustomCut(aspectRatio, shotStyle, {
                    enableVoiceover,
                    voice: selectedVoice,
                    voiceoverScript: effectiveScript,
                    enableCharacter,
                    characterAvatar: selectedAvatar,
                    characterPosition,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 shadow-sm transition disabled:opacity-50"
              >
                {isRenderingCut ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>RENDERING MP4...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-[#10B981]" />
                    <span>
                      RENDER {aspectRatio} MP4{enableCharacter ? ` + Host ${selectedAvatar.toUpperCase()}` : ""}
                    </span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                disabled={isRecordingWebm}
                onClick={handleRecordClientWebm}
                className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 shadow-sm transition disabled:opacity-50"
              >
                {isRecordingWebm ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>RECORDING 5S WEBM...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    <span>SAVE .WEBM</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {renderError && (
          <p className="font-mono text-xs font-bold text-red-500">{renderError}</p>
        )}
      </div>
    </div>
  );
}
