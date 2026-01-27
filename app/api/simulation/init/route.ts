import { NextRequest, NextResponse } from 'next/server';
import { ApiClient } from '@/lib/api';
import { WorldStateManager } from '@/lib/world';
import { Simulator } from '@/lib/simulator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startingConditions, playerInfo } = body;

    if (!startingConditions) {
      return NextResponse.json(
        { error: 'startingConditions is required' },
        { status: 400 }
      );
    }

    console.log('\n🚀 ==========================================');
    console.log('🚀 NEW SIMULATION STARTING');
    if (playerInfo) console.log(`🎮 Player mode: ${playerInfo.name}`);
    console.log('🚀 ==========================================\n');

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }

    // Create fresh instances for this request (stateless)
    const apiClient = new ApiClient({ apiKey: process.env.ANTHROPIC_API_KEY });
    const world = new WorldStateManager();
    const simulator = new Simulator(apiClient, world);

    // Initialize the world with optional player info
    await simulator.initializeWorld(startingConditions, playerInfo);

    const state = world.getState();

    return NextResponse.json({
      success: true,
      state,
    });
  } catch (error) {
    console.error('❌ ERROR initializing simulation:');
    console.error(error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to initialize simulation',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
