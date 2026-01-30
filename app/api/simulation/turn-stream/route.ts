import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { SIMULATOR_SYSTEM_PROMPT, getSimulatorTurnPrompt } from '@/lib/prompts';
import { TURN_RESULT_SCHEMA } from '@/lib/schemas';

// Type assertion for schema to work with Anthropic SDK
const turnSchema = TURN_RESULT_SCHEMA as Anthropic.Tool.InputSchema;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PartialAgentUpdate {
  agentId: string;
  action?: string;
}

// Helper to extract partial values from incomplete JSON
function extractPartialContent(jsonStr: string): { 
  headline?: string; 
  narration?: string;
  agentUpdates?: PartialAgentUpdate[];
} {
  const result: { 
    headline?: string; 
    narration?: string;
    agentUpdates?: PartialAgentUpdate[];
  } = {};
  
  // Try to extract completed agent updates (agentId + action pairs)
  const agentUpdatesMatch = jsonStr.match(/"agentUpdates"\s*:\s*\[([\s\S]*)/);
  if (agentUpdatesMatch) {
    const updates: PartialAgentUpdate[] = [];
    // Find complete agentId + action pairs
    const pattern = /\{\s*"agentId"\s*:\s*"([^"]+)"\s*,\s*"action"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
    let match;
    while ((match = pattern.exec(agentUpdatesMatch[1])) !== null) {
      updates.push({
        agentId: match[1],
        action: match[2].replace(/\\"/g, '"').replace(/\\n/g, '\n')
      });
    }
    if (updates.length > 0) {
      result.agentUpdates = updates;
    }
  }
  
  // Try to extract headline
  const headlineMatch = jsonStr.match(/"headline"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/);
  if (headlineMatch) {
    result.headline = headlineMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
  }
  
  // Try to extract narration
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
    const { currentState, playerAction } = body;

    if (!currentState) {
      return new Response(
        JSON.stringify({ error: 'currentState is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    
    // Build the prompt
    const agentsWithHistory = currentState.agents.map((a: any) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      state: a.state,
      actionHistory: a.actionHistory,
    }));

    const userMessage = getSimulatorTurnPrompt(
      currentState.context,
      agentsWithHistory,
      undefined,
      playerAction,
      currentState.history
    );

    console.log('🌊 Starting streaming turn...');

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = client.messages.stream({
            model: 'claude-haiku-4-5',
            max_tokens: 8192,
            system: SIMULATOR_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userMessage }],
            tools: [
              {
                name: 'process_turn',
                description: 'Process turn with detailed narration',
                input_schema: turnSchema,
              },
            ],
            tool_choice: { type: 'tool', name: 'process_turn' },
          });

          let jsonAccumulator = '';
          let lastHeadline = '';
          let lastNarration = '';
          let lastAgentCount = 0;
          let sentPhaseChange = false;
          let sentImageReady = false;

          for await (const event of anthropicStream) {
            if (event.type === 'content_block_delta') {
              const delta = event.delta as any;
              if (delta.type === 'input_json_delta' && delta.partial_json) {
                jsonAccumulator += delta.partial_json;
                
                // Extract partial content
                const partial = extractPartialContent(jsonAccumulator);
                
                // Stream agent updates as they complete
                if (partial.agentUpdates && partial.agentUpdates.length > lastAgentCount) {
                  const newUpdates = partial.agentUpdates.slice(lastAgentCount);
                  lastAgentCount = partial.agentUpdates.length;
                  for (const update of newUpdates) {
                    console.log(`📤 Sending agent_update for ${update.agentId}`);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                      type: 'agent_update', 
                      agentId: update.agentId,
                      action: update.action
                    })}\n\n`));
                  }
                }
                
                // Signal phase change when we hit headline (done with agent actions)
                if (partial.headline && !sentPhaseChange) {
                  sentPhaseChange = true;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'phase', phase: 'narrating' })}\n\n`));
                }
                
                // Stream headline
                if (partial.headline && partial.headline !== lastHeadline) {
                  lastHeadline = partial.headline;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'headline', content: partial.headline })}\n\n`));
                }
                
                // Stream narration
                if (partial.narration && partial.narration !== lastNarration) {
                  lastNarration = partial.narration;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'narration', content: partial.narration })}\n\n`));
                  
                  // Signal to start image generation early
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

          // Get final result and apply to state
          const finalMessage = await anthropicStream.finalMessage();
          const toolUse = finalMessage.content.find((block) => block.type === 'tool_use');
          
          if (!toolUse || toolUse.type !== 'tool_use') {
            throw new Error('No tool use in response');
          }

          const turnResult = toolUse.input as any;
          
          // Apply turn result to state (simplified version)
          const newState = { ...currentState };
          newState.turn = (currentState.turn || 0) + 1;
          
          if (turnResult.context) {
            newState.context = turnResult.context;
            newState.worldHeadline = turnResult.worldHeadline || '';
          }
          
          if (turnResult.narration) {
            newState.history = [
              ...(currentState.history || []),
              { headline: turnResult.headline || 'Turn complete', narration: turnResult.narration }
            ];
          }
          
          if (turnResult.agentUpdates && Array.isArray(turnResult.agentUpdates)) {
            for (const update of turnResult.agentUpdates) {
              const agentIdx = newState.agents.findIndex((a: any) => a.id === update.agentId);
              if (agentIdx >= 0 && update.state) {
                newState.agents[agentIdx].state = update.state;
                if (update.action) {
                  newState.agents[agentIdx].actionHistory = [
                    ...(newState.agents[agentIdx].actionHistory || []),
                    { turn: newState.turn, action: update.action }
                  ];
                }
              }
            }
          }

          // Send final state
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', state: newState })}\n\n`));
          console.log('✅ Streaming turn complete');
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
    console.error('Error setting up stream:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
