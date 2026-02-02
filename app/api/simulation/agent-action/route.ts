import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTION_SCHEMA = {
  type: 'object' as const,
  properties: {
    action: {
      type: 'string',
      description: 'What this agent does - ONE concrete sentence'
    },
    reasoning: {
      type: 'string', 
      description: 'Why - ONE short sentence'
    }
  },
  required: ['action', 'reasoning']
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent, worldContext, otherAgents, playerAction, recentHistory } = body;

    if (!agent || !worldContext) {
      return NextResponse.json(
        { error: 'agent and worldContext are required' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Build context about other agents
    const othersContext = otherAgents?.map((a: any) => 
      `- **${a.name}** (${a.type}): ${a.state}`
    ).join('\n') || 'No other agents';

    // Build recent history
    const historyContext = recentHistory?.slice(-3).map((h: any) => 
      `- ${h.headline}`
    ).join('\n') || 'No recent history';

    const isPlayer = playerAction?.agentId === agent.id;

    const prompt = `You are ${agent.name}, a ${agent.type} in this simulation.

## YOUR CURRENT STATE
${agent.state}

## WORLD CONTEXT
${worldContext}

## OTHER AGENTS
${othersContext}

## RECENT EVENTS
${historyContext}

${isPlayer ? `## YOUR DECLARED ACTION\nYou have decided to: "${playerAction.action}"` : ''}

---

${isPlayer 
  ? 'Execute your declared action briefly.'
  : 'What do you do this turn? Be specific.'}

Return a concrete action in ONE short sentence (under 15 words). Be punchy and direct. No fluff, no preamble.`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
      tools: [{
        name: 'take_action',
        description: 'Decide and describe your action this turn',
        input_schema: ACTION_SCHEMA
      }],
      tool_choice: { type: 'tool', name: 'take_action' }
    });

    const toolUse = response.content.find(block => block.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('No tool use in response');
    }

    const result = toolUse.input as { action: string; reasoning: string };

    return NextResponse.json({
      success: true,
      agentId: agent.id,
      action: result.action,
      reasoning: result.reasoning
    });
  } catch (error: any) {
    console.error('Error generating agent action:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate action' },
      { status: 500 }
    );
  }
}
