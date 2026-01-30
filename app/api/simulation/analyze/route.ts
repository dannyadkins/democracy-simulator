import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ANALYSIS_SCHEMA = {
  type: 'object' as const,
  properties: {
    headline: {
      type: 'string',
      description: 'Dramatic 5-10 word summary of how the game ended (e.g., "From Insider to Industry Pariah")'
    },
    summary: {
      type: 'string',
      description: '2-3 paragraph narrative arc of the entire game - the journey, key moments, and conclusion'
    },
    playerPerformance: {
      type: 'object',
      properties: {
        grade: { 
          type: 'string', 
          enum: ['S', 'A', 'B', 'C', 'D', 'F'],
          description: 'Letter grade for player performance toward their goal'
        },
        verdict: { 
          type: 'string', 
          description: 'One sentence verdict (e.g., "Masterful manipulation" or "Noble but naive")' 
        }
      },
      required: ['grade', 'verdict']
    },
    turningPoints: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          turn: { type: 'number' },
          event: { type: 'string', description: 'What happened' },
          impact: { type: 'string', description: 'How it changed the trajectory' }
        },
        required: ['turn', 'event', 'impact']
      },
      description: '2-3 key turning points that shaped the outcome'
    },
    whatWentRight: {
      type: 'array',
      items: { type: 'string' },
      description: '2-3 things the player did well'
    },
    whatWentWrong: {
      type: 'array',
      items: { type: 'string' },
      description: '2-3 mistakes or missed opportunities'
    },
    alternativePath: {
      type: 'string',
      description: 'One compelling alternative strategy the player could have pursued for a better outcome'
    },
    finalStandings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          outcome: { type: 'string', description: 'Brief description of where they ended up' }
        },
        required: ['name', 'outcome']
      },
      description: 'Final status of all major agents'
    }
  },
  required: ['headline', 'summary', 'playerPerformance', 'turningPoints', 'whatWentRight', 'whatWentWrong', 'alternativePath', 'finalStandings']
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameHistory, playerName, playerGoal, agents, finalContext } = body;

    if (!gameHistory || !playerName) {
      return NextResponse.json(
        { error: 'gameHistory and playerName are required' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Build the game history narrative
    const historyNarrative = gameHistory.map((h: any, idx: number) => 
      `**Turn ${h.turn}**: ${h.headline}\n${h.narration}`
    ).join('\n\n---\n\n');

    // Build agent final states
    const agentStates = agents?.map((a: any) => 
      `- **${a.name}** (${a.type}): ${a.state}`
    ).join('\n') || '';

    // Build player action history
    const playerAgent = agents?.find((a: any) => a.name === playerName);
    const playerActions = playerAgent?.actionHistory?.map((h: any) => 
      `Turn ${h.turn}: ${h.action}`
    ).join('\n') || 'No recorded actions';

    const prompt = `Analyze this completed simulation game.

## PLAYER
**Name**: ${playerName}
**Goal**: ${playerGoal || 'Maximize influence and achieve their objectives'}

## PLAYER'S ACTIONS THROUGHOUT THE GAME
${playerActions}

## COMPLETE GAME HISTORY
${historyNarrative}

## FINAL WORLD STATE
${finalContext || 'Game concluded'}

## FINAL AGENT STATES
${agentStates}

---

Provide a comprehensive, entertaining, and insightful post-game analysis. Be specific about:
- What the player did and how it affected outcomes
- Key moments where decisions mattered
- What could have gone differently
- The ultimate fate of all major players

Be honest but not harsh. Highlight both good plays and mistakes. Make it feel like a sports post-game analysis - engaging, specific, and illuminating.`;

    console.log('📊 Generating game analysis...');

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
      tools: [{
        name: 'analyze_game',
        description: 'Generate comprehensive post-game analysis',
        input_schema: ANALYSIS_SCHEMA
      }],
      tool_choice: { type: 'tool', name: 'analyze_game' }
    });

    const toolUse = response.content.find(block => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('No tool use in response');
    }

    console.log('✅ Game analysis complete');

    return NextResponse.json({
      success: true,
      analysis: toolUse.input
    });
  } catch (error: any) {
    console.error('Error generating analysis:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate analysis' },
      { status: 500 }
    );
  }
}
