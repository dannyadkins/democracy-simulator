import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

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

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: avatarPrompt,
      config: {
        responseModalities: ["Image"],
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts;

    if (!parts || parts.length === 0) {
      console.error("❌ No parts in response. Candidate:", JSON.stringify(candidate, null, 2));
      throw new Error("No content in response - may have been filtered");
    }

    let imageData: string | null = null;
    let textResponse: string | null = null;

    for (const part of parts) {
      if (part.inlineData?.data) {
        imageData = part.inlineData.data;
        break;
      }
      if (part.text) {
        textResponse = part.text;
      }
    }

    if (!imageData) {
      if (textResponse) {
        console.error("❌ Got text instead of image:", textResponse.slice(0, 200));
        throw new Error(`Model returned text instead of image: ${textResponse.slice(0, 100)}`);
      }
      throw new Error("No image data returned");
    }

    return NextResponse.json({
      success: true,
      imageUrl: `data:image/png;base64,${imageData}`,
    });
  } catch (error: any) {
    console.error("Error generating avatar:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate avatar" },
      { status: 500 },
    );
  }
}
