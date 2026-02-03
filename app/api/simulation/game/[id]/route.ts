import { NextRequest, NextResponse } from 'next/server';
import { getGame } from '@/lib/game-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing game id' }, { status: 400 });
    }

    const game = await getGame(id);
    if (!game) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, game });
  } catch (error) {
    console.error('Error loading game:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load game' },
      { status: 500 }
    );
  }
}
