import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { generateImageWithFallback } from "@/lib/image-generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { headline, narration, agents } = body;

    if (!headline || !narration) {
      return NextResponse.json(
        { error: "headline and narration are required" },
        { status: 400 },
      );
    }

    const clip = (value: string | undefined, limit: number) => {
      if (!value) return '';
      const trimmed = value.replace(/\s+/g, ' ').trim();
      if (!trimmed) return '';
      return trimmed.length > limit ? `${trimmed.slice(0, limit).trim()}...` : trimmed;
    };

    // Build character descriptions from agents if available
    let characterGuide = '';
    if (agents && agents.length > 0) {
      const keyAgents = agents.slice(0, 5).map((a: any) => {
        const avatarNote = a.avatarDescription ? `Appearance: ${clip(a.avatarDescription, 160)}` : '';
        const avatarPrompt = a.avatarPrompt ? `Avatar spec: ${clip(a.avatarPrompt, 240)}` : '';
        const appearance = a.appearance ? `Explicit look: ${clip(a.appearance, 220)}` : '';
        const details = [appearance, avatarNote, avatarPrompt].filter(Boolean).join(' | ');
        return `${a.name} (${a.type})${details ? ` — ${details}` : ''}`;
      }).join(', ');
      characterGuide = `\nCHARACTER REFERENCES (optional, do not force inclusion): ${keyAgents}. Use these as visual references only if they naturally fit the scene; otherwise keep them as background cameos or omit. If a named character appears, match their explicit appearance cues closely and avoid inventing extra traits.`;
    }

    const baseScenePrompt = `Funny satirical illustration of: "${headline}"

Context: ${narration.slice(0, 250)}

STYLE: Bold absurdist editorial tableau with playful surrealism. Think witty magazine cover meets theatrical stage set.
MEDIUM: 2D illustration with crisp ink linework, gouache color blocks, halftone shadows, and subtle paper-cut collage texture. No photorealism.
PALETTE: Warm parchment, deep navy, teal, coral, and soft gold accents. Strong contrast, gentle grain.
COMPOSITION: Cinematic wide shot with a single focal gag, clear silhouettes, and supporting background details that reward a second look.
${characterGuide}
DIVERSITY: Cast must be diverse - include women leaders, people of color in power, different ages, varied body types. A global cast, not just white men in suits. Make it feel like a modern international scene.

COMEDY APPROACH (pick one): 
- Absurd scale (tiny person, giant object)
- Literal metaphor made visual
- Calm professionals ignoring chaos behind them
- One bizarre detail that doesn't belong

VIBE: Serious diverse professionals treating insanity as normal, with a smart absurdist edge. Slightly theatrical, elegant, and quirky. NO TEXT IN IMAGE.`;

    const buildGeneratedPrompt = async () => {
      if (!process.env.ANTHROPIC_API_KEY) return baseScenePrompt;

      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const generatorPrompt = `
You are an art director crafting a highly specific, funny, absurdist editorial illustration prompt for an image model.

GOAL: Produce a fresh, varied, comical scene (avoid repetitiveness). Invent a clear visual gag.

INPUT:
- Headline: "${headline}"
- Context: "${narration.slice(0, 250)}"
${characterGuide ? `- Character references (optional, do not force): ${characterGuide.replace(/\n/g, ' ')}` : ''}

REQUIREMENTS:
- 16:9 cinematic wide shot.
- 2D illustration: crisp ink linework + gouache blocks + halftone shadows + subtle paper-cut texture. No photorealism.
- Absurdist editorial vibe, witty, theatrical, slightly surreal, fun.
- Include 1 strong central visual gag and 1 small secondary gag.
- If you include any named character, match explicit appearance cues closely.
- Diverse cast if multiple figures appear.
- No text in image.

OUTPUT: Return ONLY the final image prompt (1-2 short paragraphs max).`;

      const result = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 700,
        messages: [{ role: "user", content: generatorPrompt }],
      });

      const textBlock = result.content.find((b) => b.type === "text");
      return textBlock && "text" in textBlock && textBlock.text ? textBlock.text.trim() : baseScenePrompt;
    };

    const imagePrompt = await buildGeneratedPrompt();


    console.log("🎨 Generating image for:", headline.slice(0, 50));
    const { imageBase64, provider, model } = await generateImageWithFallback({
      prompt: imagePrompt,
      geminiAspectRatio: "16:9",
      openaiSize: "1536x1024",
      label: "scene",
    });
    console.log(`✅ Image generated (${provider}:${model})`);

    // Return as data URL for direct use in img src
    return NextResponse.json({
      success: true,
      imageUrl: `data:image/png;base64,${imageBase64}`,
    });
  } catch (error: any) {
    console.error("Error generating image:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate image" },
      { status: 500 },
    );
  }
}
