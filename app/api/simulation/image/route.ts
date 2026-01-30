import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

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

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Build character descriptions from agents if available
    let characterGuide = '';
    if (agents && agents.length > 0) {
      const keyAgents = agents.slice(0, 5).map((a: any) => `${a.name} (${a.type})`).join(', ');
      characterGuide = `\nKEY CHARACTERS to feature: ${keyAgents}. Depict them as diverse individuals - vary ethnicities, genders, ages. Make each visually distinctive.`;
    }

    // Zany but tasteful editorial illustration with diverse characters
    const imagePrompt = `Funny satirical illustration of: "${headline}"

Context: ${narration.slice(0, 250)}

STYLE: Elegant editorial cartoon, like Monocle meets Gary Larson. Navy, cream, and coral palette. Clean linework.
${characterGuide}
DIVERSITY: Cast must be diverse - include women leaders, people of color in power, different ages, varied body types. A global cast, not just white men in suits. Make it feel like a modern international scene.

COMEDY APPROACH (pick one): 
- Absurd scale (tiny person, giant object)
- Literal metaphor made visual
- Calm professionals ignoring chaos behind them
- One bizarre detail that doesn't belong

VIBE: Serious diverse professionals treating insanity as normal. Wes Anderson directing a global political thriller. NO TEXT IN IMAGE.`;


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

    // Log what we got back for debugging
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
