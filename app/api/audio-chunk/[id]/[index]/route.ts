/**
 * Serve individual audio chunks for streaming playback
 */

import { NextRequest, NextResponse } from 'next/server';
import { ChunkManager } from '@/lib/streaming/chunk-manager';

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string; index: string }> }
) {
  const params = await props.params;
  const { id, index } = params;

  try {
    const chunkIndex = parseInt(index, 10);
    if (isNaN(chunkIndex) || chunkIndex < 0) {
      return NextResponse.json(
        { error: 'Invalid chunk index' },
        { status: 400 }
      );
    }

    const chunkManager = new ChunkManager(id);
    const audioBuffer = await chunkManager.readChunk(chunkIndex);

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(audioBuffer);

    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error: any) {
    console.error(`Failed to serve chunk ${index} for job ${id}:`, error);

    if (error.message?.includes('not found')) {
      return NextResponse.json(
        { error: 'Chunk not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to retrieve audio chunk' },
      { status: 500 }
    );
  }
}