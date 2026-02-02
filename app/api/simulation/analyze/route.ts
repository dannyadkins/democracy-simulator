import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

    if (!playerName) {
      return NextResponse.json(
        { error: 'playerName is required' },
        { status: 400 }
      );
    }

    // Handle empty or missing history
    if (!gameHistory || !Array.isArray(gameHistory) || gameHistory.length === 0) {
      return NextResponse.json(
        { error: 'No game history to analyze. Play at least one turn first.' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Build the game history narrative
    const historyNarrative = gameHistory.map((h: any) => 
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

    const prompt = `Analyze this completed simulation game and provide a comprehensive post-game report.

## PLAYER INFO
- **Name**: ${playerName}
- **Goal**: ${playerGoal || 'Maximize influence and achieve their objectives'}

## PLAYER'S ACTIONS
${playerActions}

## GAME HISTORY (${gameHistory.length} turns)
${historyNarrative}

## FINAL STATE
${finalContext || 'Game concluded'}

## ALL AGENTS' FINAL STATUS
${agentStates}

---

## INSTRUCTIONS

You MUST provide ALL of the following in your analysis:

1. **headline**: A dramatic 5-10 word summary (e.g., "The Reformer Who Changed Everything")

2. **summary**: 2-3 paragraphs describing the full arc of the game

3. **playerPerformance**: 
   - grade: One of S/A/B/C/D/F based on goal achievement
   - verdict: One punchy sentence (e.g., "Brilliant strategist who played the long game")

4. **turningPoints**: 2-3 key moments with turn number, event description, and impact

5. **whatWentRight**: 2-3 specific things the player did well

6. **whatWentWrong**: 2-3 mistakes or missed opportunities  

7. **alternativePath**: One alternative strategy that could have worked better

8. **finalStandings**: Where each major agent ended up

Be specific and reference actual events from the game. Make it entertaining like a sports commentary.`;

    console.log('📊 Generating game analysis for', playerName, 'with', gameHistory.length, 'turns...');

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
      tools: [{
        name: 'analyze_game',
        description: 'Generate comprehensive post-game analysis with ALL required fields',
        input_schema: ANALYSIS_SCHEMA
      }],
      tool_choice: { type: 'tool', name: 'analyze_game' }
    });

    const toolUse = response.content.find(block => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      console.error('No tool use in response. Content:', JSON.stringify(response.content));
      throw new Error('No tool use in response');
    }

    const rawAnalysis = toolUse.input as any;
    console.log('📊 Raw analysis keys:', Object.keys(rawAnalysis));
    console.log('📊 playerPerformance:', rawAnalysis.playerPerformance);
    console.log('📊 whatWentRight:', rawAnalysis.whatWentRight);
    console.log('📊 whatWentWrong:', rawAnalysis.whatWentWrong);
    
    // Validate and provide defaults for missing fields
    const analysis = {
      headline: rawAnalysis.headline || 'Game Complete',
      summary: rawAnalysis.summary || 'The simulation has concluded.',
      playerPerformance: {
        grade: rawAnalysis.playerPerformance?.grade || 'C',
        verdict: rawAnalysis.playerPerformance?.verdict || 'Performance varied throughout the game.'
      },
      turningPoints: Array.isArray(rawAnalysis.turningPoints) ? rawAnalysis.turningPoints : [],
      whatWentRight: Array.isArray(rawAnalysis.whatWentRight) ? rawAnalysis.whatWentRight : ['Participated in the simulation'],
      whatWentWrong: Array.isArray(rawAnalysis.whatWentWrong) ? rawAnalysis.whatWentWrong : ['Could have been more strategic'],
      alternativePath: rawAnalysis.alternativePath || 'Different approaches could have led to different outcomes.',
      finalStandings: Array.isArray(rawAnalysis.finalStandings) ? rawAnalysis.finalStandings : []
    };

    console.log('✅ Game analysis complete');

    return NextResponse.json({
      success: true,
      analysis
    });
  } catch (error: any) {
    console.error('Error generating analysis:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate analysis' },
      { status: 500 }
    );
  }
}
