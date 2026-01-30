import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NARRATION_SCHEMA = {
  type: 'object' as const,
  properties: {
    headline: {
      type: 'string',
      description: 'Punchy 5-10 word headline with in-world date (e.g., "**March 2026**: OpenAI Launches GPT-6")'
    },
    narration: {
      type: 'string',
      description: '2-3 paragraphs dramatically narrating the key events, consequences, and power shifts'
    },
    context: {
      type: 'string',
      description: 'Updated world context (2-3 sentences) reflecting new state with current in-world date'
    },
    agentStateUpdates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          newState: { type: 'string', description: 'Updated agent state after this turn' }
        },
        required: ['agentId', 'newState']
      }
    }
  },
  required: ['headline', 'narration', 'context', 'agentStateUpdates']
};

// Helper to extract partial content from streaming JSON
function extractPartialContent(jsonStr: string): { headline?: string; narration?: string } {
  const result: { headline?: string; narration?: string } = {};
  
  const headlineMatch = jsonStr.match(/"headline"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/);
  if (headlineMatch) {
    result.headline = headlineMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
  }
  
  const narrationMatch = jsonStr.match(/"narration"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/);
  if (narrationMatch) {
    result.narration = narrationMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
  }
  
  return result;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  try {
    const body = await request.json();
    const { currentState, agentActions, playerAction } = body;

    if (!currentState || !agentActions) {
      return new Response(
        JSON.stringify({ error: 'currentState and agentActions are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Build the actions summary
    const actionsSummary = agentActions.map((aa: any) => {
      const agent = currentState.agents.find((a: any) => a.id === aa.agentId);
      return `**${agent?.name || 'Unknown'}** (${agent?.type || 'Agent'}): ${aa.action}`;
    }).join('\n\n');

    const prompt = `## CURRENT WORLD STATE
${currentState.context}

## AGENTS AND THEIR ACTIONS THIS TURN
${actionsSummary}

${playerAction ? `\n## PLAYER ACTION\nThe player controlling an agent declared: "${playerAction.action}"` : ''}

---

## YOUR TASK

Write a succinct narrative of this turn. Focus on consequences, power shifts, and key dynamics.

PACING (be bold with time jumps):
- Default: WEEKS to MONTHS between turns
- Cold war / positioning: MONTHS to YEARS  
- Crisis / climax: DAYS to WEEKS

FORMAT (be very concise):
- headline: **In-world date** + punchy summary (e.g., "**March 2026**: OpenAI Launches GPT-5")
- narration: 1 SHORT paragraph, punchy. Max 3-4 sentences. **bold** key events.
- context: World state in 1-2 sentences with new date
- agentStateUpdates: 1 short sentence per agent`;

    console.log('📝 Starting narrative generation...');

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = client.messages.stream({
            model: 'claude-haiku-4-5',
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }],
            tools: [{
              name: 'narrate_turn',
              description: 'Generate narrative for the turn',
              input_schema: NARRATION_SCHEMA
            }],
            tool_choice: { type: 'tool', name: 'narrate_turn' }
          });

          let jsonAccumulator = '';
          let lastHeadline = '';
          let lastNarration = '';
          let sentImageReady = false;

          for await (const event of anthropicStream) {
            if (event.type === 'content_block_delta') {
              const delta = event.delta as any;
              if (delta.type === 'input_json_delta' && delta.partial_json) {
                jsonAccumulator += delta.partial_json;
                
                const partial = extractPartialContent(jsonAccumulator);
                
                if (partial.headline && partial.headline !== lastHeadline) {
                  lastHeadline = partial.headline;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'headline', content: partial.headline })}\n\n`));
                }
                
                if (partial.narration && partial.narration !== lastNarration) {
                  lastNarration = partial.narration;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'narration', content: partial.narration })}\n\n`));
                  
                  if (!sentImageReady && lastHeadline && lastNarration.length > 100) {
                    sentImageReady = true;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                      type: 'image_ready', 
                      headline: lastHeadline, 
                      narration: lastNarration.slice(0, 200) 
                    })}\n\n`));
                  }
                }
              }
            }
          }

          // Get final result
          const finalMessage = await anthropicStream.finalMessage();
          const toolUse = finalMessage.content.find(block => block.type === 'tool_use');
          
          if (!toolUse || toolUse.type !== 'tool_use') {
            throw new Error('No tool use in response');
          }

          const result = toolUse.input as any;
          
          // Build new state
          const newState = { ...currentState };
          newState.turn = (currentState.turn || 0) + 1;
          newState.context = result.context || currentState.context;
          newState.worldHeadline = result.headline || '';
          newState.history = [
            ...(currentState.history || []),
            { turn: newState.turn, headline: result.headline, narration: result.narration }
          ];
          
          // Apply agent actions and state updates
          for (const aa of agentActions) {
            const agentIdx = newState.agents.findIndex((a: any) => a.id === aa.agentId);
            if (agentIdx >= 0) {
              // Update action history
              newState.agents[agentIdx].actionHistory = [
                ...(newState.agents[agentIdx].actionHistory || []),
                { turn: newState.turn, action: aa.action }
              ];
              
              // Update state if provided
              const stateUpdate = result.agentStateUpdates?.find((u: any) => u.agentId === aa.agentId);
              if (stateUpdate?.newState) {
                newState.agents[agentIdx].state = stateUpdate.newState;
              }
            }
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', state: newState })}\n\n`));
          console.log('✅ Narrative complete');
          controller.close();
        } catch (error: any) {
          console.error('Stream error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Error setting up narration stream:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
