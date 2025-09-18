import { NextRequest, NextResponse } from 'next/server';
import { saveLotteryPlay } from '../../../../lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, profileImage, numbers, message, walletAddress } = body;
    
    if (!username || !numbers || !message) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields'
        },
        { status: 400 }
      );
    }
    
    const lotteryPlay = {
      username,
      profileImage,
      numbers,
      timestamp: new Date(),
      message,
      walletAddress
    };
    
    const playId = await saveLotteryPlay(lotteryPlay);
    
    return NextResponse.json({
      success: true,
      data: { id: playId }
    });
  } catch (error) {
    console.error('Failed to save lottery play:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save lottery play'
      },
      { status: 500 }
    );
  }
}