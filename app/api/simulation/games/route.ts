import { NextResponse } from 'next/server';
import { listGames } from '@/lib/game-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const games = await listGames(12);
    return NextResponse.json({ success: true, games });
  } catch (error) {
    console.error('Error listing games:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load recent games' },
      { status: 500 }
    );
  }
}
