import { NextRequest, NextResponse } from 'next/server';
import { simulationInstance } from '@/lib/simulation-instance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const world = await simulationInstance.getWorld();
    const state = world.getState();

    return NextResponse.json({
      success: true,
      state: {
        turn: state.turn,
        context: state.context,
        agents: state.agents.map(a => ({
          id: a.id,
          name: a.name,
          type: a.type,
          state: a.state,
        })),
        history: state.history,
      },
    });
  } catch (error) {
    console.error('Error getting state:', error);
    return NextResponse.json(
      { error: 'Failed to get state' },
      { status: 500 }
    );
  }
}
