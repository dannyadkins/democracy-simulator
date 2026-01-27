import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { headline, narration } = body;

    if (!headline || !narration) {
      return NextResponse.json(
        { error: 'headline and narration are required' },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Create a prompt for Ghibli-style image
    const imagePrompt = `Studio Ghibli anime style illustration, whimsical and dreamlike: 

${headline}

Scene details: ${narration.slice(0, 300)}

Style: Soft watercolor textures, warm lighting, expressive characters, detailed backgrounds with a sense of wonder. Hayao Miyazaki inspired. Vibrant but gentle colors. Slightly exaggerated expressions showing the drama. Wide cinematic composition.`;

    console.log('🎨 Generating image for:', headline.slice(0, 50));

    // Use Nano Banana (gemini-2.5-flash-image) for fast image generation
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: imagePrompt,
      config: {
        responseModalities: ['Image'],
        imageConfig: {
          aspectRatio: '16:9',
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
      throw new Error('No image data returned');
    }

    console.log('✅ Image generated (Nano Banana)');

    // Return as data URL for direct use in img src
    return NextResponse.json({
      success: true,
      imageUrl: `data:image/png;base64,${imageData}`,
    });
  } catch (error: any) {
    console.error('Error generating image:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate image' },
      { status: 500 }
    );
  }
}
