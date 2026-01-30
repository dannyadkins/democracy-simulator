import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUGGESTIONS_SCHEMA = {
  type: 'object' as const,
  properties: {
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { 
            type: 'string', 
            description: 'Short 3-5 word action title (e.g., "Go Public with Evidence")' 
          },
          description: { 
            type: 'string', 
            description: 'One sentence describing the action' 
          },
          strategy: {
            type: 'string',
            enum: ['aggressive', 'defensive', 'diplomatic'],
            description: 'The strategic approach this represents'
          }
        },
        required: ['title', 'description', 'strategy']
      },
      minItems: 3,
      maxItems: 3
    }
  },
  required: ['actions']
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { player, worldContext, otherAgents, goal, recentHistory } = body;

    if (!player || !worldContext) {
      return NextResponse.json(
        { error: 'player and worldContext are required' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const othersContext = otherAgents?.map((a: any) => 
      `- **${a.name}** (${a.type}): ${a.state}`
    ).join('\n') || 'No other agents';

    const historyContext = recentHistory?.slice(-3).map((h: any) => 
      `- ${h.headline}`
    ).join('\n') || 'No recent history';

    const prompt = `You are a strategic advisor for ${player.name} in this simulation.

## PLAYER'S CURRENT STATE
${player.state}

## PLAYER'S GOAL
${goal || 'Maximize influence and achieve their objectives'}

## WORLD CONTEXT
${worldContext}

## OTHER KEY PLAYERS
${othersContext}

## RECENT EVENTS
${historyContext}

---

Suggest 3 distinct actions representing different strategies:
1. **Aggressive**: Bold move, seize opportunity
2. **Defensive**: Cautious, consolidate position  
3. **Diplomatic**: Build alliances, negotiate

Keep titles to 3-5 words. Descriptions should be ONE sentence max. Be specific, not vague.`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
      tools: [{
        name: 'suggest_actions',
        description: 'Suggest 3 strategic actions for the player',
        input_schema: SUGGESTIONS_SCHEMA
      }],
      tool_choice: { type: 'tool', name: 'suggest_actions' }
    });

    const toolUse = response.content.find(block => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('No tool use in response');
    }

    const result = toolUse.input as { actions: any[] };

    return NextResponse.json({
      success: true,
      actions: result.actions
    });
  } catch (error: any) {
    console.error('Error generating action suggestions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
