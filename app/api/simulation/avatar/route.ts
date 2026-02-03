import { NextRequest, NextResponse } from "next/server";
import { generateImageWithFallback } from "@/lib/image-generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, description, name, type } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 },
      );
    }

    const avatarPrompt = `
Create a polished, recognizable cartoon avatar portrait.
${name ? `Name: ${name}` : ''} ${type ? `Role: ${type}` : ''}
${description ? `Appearance cues: ${description}` : ''}

PRIORITY:
- Use explicit appearance cues when provided; do not infer beyond them.
- If this is a real public figure, preserve their distinctive features (hair style/color, face shape, skin tone, expression).
- Avoid randomizing identity-defining traits.

STYLE:
- Clean linework, soft shading, friendly but accurate expression
- Head-and-shoulders only, centered
- Simple background with a soft circle or gradient
- Modern, crisp, not childish, no text
- High-quality, vector-like finish

BASE PROMPT:
${prompt}
`;

    const { imageBase64 } = await generateImageWithFallback({
      prompt: avatarPrompt,
      geminiAspectRatio: "1:1",
      openaiSize: "1024x1024",
      openaiQuality: "high",
      label: "avatar",
    });

    return NextResponse.json({
      success: true,
      imageUrl: `data:image/png;base64,${imageBase64}`,
    });
  } catch (error: any) {
    console.error("Error generating avatar:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate avatar" },
      { status: 500 },
    );
  }
}
