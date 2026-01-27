import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { headline, narration } = body;

    if (!headline || !narration) {
      return NextResponse.json(
        { error: "headline and narration are required" },
        { status: 400 },
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // New Yorker cartoon style - witty, understated, clever visual humor
    const imagePrompt = `A single-panel New Yorker magazine cartoon depicting this scene:

"${headline}"

What's happening: ${narration.slice(0, 250)}

CRITICAL STYLE REQUIREMENTS:
- Classic New Yorker cartoon aesthetic: simple ink linework, minimal color (light watercolor wash), lots of white space
- The humor should be DRY and WITTY, not wacky - think a knowing smirk, not a belly laugh
- Find the ABSURD TRUTH in the situation - the joke is how relatable/ridiculous the power dynamics are
- Characters should look like normal professionals in absurd situations (boardrooms, offices, conferences)
- Body language and facial expressions carry the comedy - subtle exasperation, false confidence, quiet panic
- One clear visual gag or ironic juxtaposition that makes the viewer go "hah, yeah"
- NO TEXT, NO CAPTIONS, NO WORDS - the image alone must be funny
- Sophisticated humor that rewards intelligence - the kind of joke you'd explain at a dinner party
- Clean, elegant composition - this could hang in a waiting room at Andreessen Horowitz`;


    console.log("🎨 Generating image for:", headline.slice(0, 50));

    // Use Nano Banana (gemini-2.5-flash-image) for fast image generation
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: imagePrompt,
      config: {
        responseModalities: ["Image"],
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    });

    // Extract image from response
    const candidate = response.candidates?.[0];
    const parts = candidate?.content?.parts;

    let imageData: string | null = null;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData?.data) {
          imageData = part.inlineData.data;
          break;
        }
      }
    }

    if (!imageData) {
      throw new Error("No image data returned");
    }

    console.log("✅ Image generated (Nano Banana)");

    // Return as data URL for direct use in img src
    return NextResponse.json({
      success: true,
      imageUrl: `data:image/png;base64,${imageData}`,
    });
  } catch (error: any) {
    console.error("Error generating image:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate image" },
      { status: 500 },
    );
  }
}
