import { NextRequest, NextResponse } from 'next/server';
import { ApiClient } from '@/lib/api';
import { WorldStateManager } from '@/lib/world';
import { Simulator } from '@/lib/simulator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentState, intervention, playerAction } = body;

    if (!currentState) {
      return NextResponse.json(
        { error: 'currentState is required' },
        { status: 400 }
      );
    }

    console.log('\n⏩ ==========================================');
    console.log(intervention ? '⏩ INJECTING EVENT' : '⏩ EXECUTING NEXT TURN');
    if (playerAction) console.log(`🎮 Player action: ${playerAction.action}`);
    console.log('⏩ ==========================================\n');
    console.log(`📥 Received state with ${currentState.agents.length} agents`);

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }

    // Create fresh instances (stateless)
    const apiClient = new ApiClient({ apiKey: process.env.ANTHROPIC_API_KEY });
    const world = new WorldStateManager();

    world.restoreState(currentState);
    const simulator = new Simulator(apiClient, world);

    await simulator.executeTurn(intervention, playerAction);

    return NextResponse.json({
      success: true,
      state: world.getState(),
    });
  } catch (error) {
    console.error('Error executing turn:', error);
    return NextResponse.json(
      { error: 'Failed to execute turn' },
      { status: 500 }
    );
  }
}
