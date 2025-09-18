import { NextRequest, NextResponse } from 'next/server';
import { getRecentLotteryPlays } from '../../../lib/database';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');
    
    const lotteryPlays = await getRecentLotteryPlays(limit);
    
    return NextResponse.json({
      success: true,
      data: lotteryPlays
    });
  } catch (error) {
    console.error('Failed to fetch lottery plays:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch lottery plays'
      },
      { status: 500 }
    );
  }
}