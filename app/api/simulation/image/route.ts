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

    // Create a prompt inspired by Stanford GSB "AI & Power" vibes - satirical, smart, fun
    const imagePrompt = `Satirical editorial illustration for a smart, funny take on tech power dynamics.

SCENE: ${headline}

CONTEXT: ${narration.slice(0, 350)}

STYLE DIRECTION:
- Think "Silicon Valley meets The Economist meets a really good meme"
- Slightly absurdist, self-aware humor about tech elites, VCs in Patagonia vests, AI doom discourse
- Characters can include: nervous MBAs, smug founders, confused regulators, sentient AI with existential dread
- Visual metaphors welcome: chess pieces, puppet strings, Eames chairs, whiteboards with concerning diagrams
- Color palette: Stanford cardinal red accents, tech-bro navy, VC khaki, with pops of AI electric blue
- Clean, graphic illustration style - like McSweeney's or a New Yorker cartoon had a baby with Figma
- Dramatic but playful - the stakes are real but we can laugh about how weird this all is
- No text or words in the image
- Capture the absurdity of humans trying to manage power dynamics with entities smarter than them
- A tiny detail somewhere that makes you chuckle on second viewing`;


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
