import { NextRequest, NextResponse } from 'next/server';
import { ApiClient } from '@/lib/api';
import { WorldStateManager } from '@/lib/world';
import { Simulator } from '@/lib/simulator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentState, goal, consciousActorId } = body;

    if (!currentState || !goal || !consciousActorId) {
      return NextResponse.json(
        { error: 'currentState, goal, and consciousActorId are required' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }

    const apiClient = new ApiClient({ apiKey: process.env.ANTHROPIC_API_KEY });
    const world = new WorldStateManager();
    world.restoreState(currentState);
    const simulator = new Simulator(apiClient, world);

    const actionResult = await simulator.getAutopilotAction(goal, consciousActorId);

    return NextResponse.json({
      success: true,
      action: actionResult,
    });
  } catch (error) {
    console.error('Error getting autopilot action:', error);
    return NextResponse.json(
      { error: 'Failed to get autopilot action' },
      { status: 500 }
    );
  }
}
