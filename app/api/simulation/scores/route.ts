import { NextRequest, NextResponse } from 'next/server';
import { ApiClient } from '@/lib/api';
import { WorldStateManager } from '@/lib/world';
import { Simulator } from '@/lib/simulator';
import { getGame } from '@/lib/game-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentState, gameId } = body;

    let baseState = currentState;
    if (!baseState && gameId) {
      try {
        const record = await getGame(gameId);
        if (record?.state) baseState = record.state;
      } catch (e) {
        console.warn('KV load failed for scores:', e);
      }
    }

    if (!baseState) {
      return NextResponse.json(
        { error: 'currentState is required' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }

    const apiClient = new ApiClient({ apiKey: process.env.ANTHROPIC_API_KEY });
    const world = new WorldStateManager();
    world.restoreState(baseState);
    const simulator = new Simulator(apiClient, world);

    const scores = await simulator.scoreAllAgents();

    return NextResponse.json({
      success: true,
      scores: scores.scores,
    });
  } catch (error) {
    console.error('Error scoring agents:', error);
    return NextResponse.json(
      { error: 'Failed to score agents' },
      { status: 500 }
    );
  }
}
