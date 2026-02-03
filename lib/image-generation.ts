import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
const OPENAI_IMAGE_MODEL = "gpt-image-1";

type OpenAIImageSize = "1024x1024" | "1536x1024" | "1024x1536" | "auto";
type OpenAIImageQuality = "low" | "medium" | "high";

export type ImageFallbackOptions = {
  prompt: string;
  geminiAspectRatio: string;
  openaiSize: OpenAIImageSize;
  openaiQuality?: OpenAIImageQuality;
  label?: string;
};

export type ImageFallbackResult = {
  imageBase64: string;
  provider: "gemini" | "openai";
  model: string;
};

const toErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
};

const extractGeminiImageData = (response: any) => {
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts;

  if (!parts || parts.length === 0) {
    console.error("❌ No parts in Gemini response. Candidate:", JSON.stringify(candidate, null, 2));
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
      console.error("❌ Gemini returned text instead of image:", textResponse.slice(0, 200));
      throw new Error(`Model returned text instead of image: ${textResponse.slice(0, 100)}`);
    }
    throw new Error("No image data returned");
  }

  return imageData;
};

const generateWithGemini = async (prompt: string, aspectRatio: string) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response: any = await ai.models.generateContent({
    model: GEMINI_IMAGE_MODEL,
    contents: prompt,
    config: {
      responseModalities: ["Image"],
      imageConfig: {
        aspectRatio,
      },
    },
  });

  return extractGeminiImageData(response);
};

const generateWithOpenAI = async (
  prompt: string,
  size: OpenAIImageSize,
  quality: OpenAIImageQuality = "medium",
) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.images.generate({
    model: OPENAI_IMAGE_MODEL,
    prompt,
    size,
    quality,
    output_format: "png",
  });

  const imageBase64 = response.data?.[0]?.b64_json;
  if (!imageBase64) {
    throw new Error("OpenAI returned no image data");
  }

  return imageBase64;
};

export async function generateImageWithFallback(
  options: ImageFallbackOptions,
): Promise<ImageFallbackResult> {
  const { prompt, geminiAspectRatio, openaiSize, openaiQuality, label } = options;
  const prefix = label ? `[${label}]` : "[image]";
  let lastGeminiError: string | null = null;

  if (process.env.GEMINI_API_KEY) {
    try {
      const imageBase64 = await generateWithGemini(prompt, geminiAspectRatio);
      return { imageBase64, provider: "gemini", model: GEMINI_IMAGE_MODEL };
    } catch (error) {
      lastGeminiError = toErrorMessage(error);
      console.error(`${prefix} Gemini image generation failed:`, error);
    }
  } else {
    lastGeminiError = "GEMINI_API_KEY environment variable is not set";
    console.warn(`${prefix} ${lastGeminiError}`);
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      `OpenAI fallback unavailable. ${lastGeminiError ?? "Gemini failed unexpectedly."}`,
    );
  }

  try {
    const imageBase64 = await generateWithOpenAI(prompt, openaiSize, openaiQuality);
    return { imageBase64, provider: "openai", model: OPENAI_IMAGE_MODEL };
  } catch (error) {
    console.error(`${prefix} OpenAI image generation failed:`, error);
    throw new Error(`OpenAI image generation failed: ${toErrorMessage(error)}`);
  }
}
