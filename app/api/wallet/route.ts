import { NextResponse } from 'next/server';
import { isAddress } from 'ethers';
import { saveWalletAddress } from '@/lib/db';

export async function POST(request: Request) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload in request body' },
        { status: 400 }
      );
    }

    const { address } = body || {};

    // Validate payload existence and string type
    if (!address || typeof address !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "address" field in request body' },
        { status: 400 }
      );
    }

    const trimmedAddress = address.trim();

    // Validate Ethereum address checksum / format using ethers
    if (!isAddress(trimmedAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid Ethereum wallet address format' },
        { status: 400 }
      );
    }

    // Save to PostgreSQL with duplicate handling (ON CONFLICT DO UPDATE)
    try {
      const savedRecord = await saveWalletAddress(trimmedAddress);
      return NextResponse.json(
        {
          success: true,
          message: savedRecord.dbStatus === 'unconfigured' 
            ? 'Wallet address received (Database unconfigured on host)'
            : 'Wallet address saved successfully',
          savedToDb: savedRecord.dbStatus !== 'unconfigured',
          data: savedRecord,
        },
        { status: 200 }
      );
    } catch (dbError: any) {
      console.error('Database error in /api/wallet:', dbError);
      // Fallback response on Vercel serverless when database connection fails or times out
      return NextResponse.json(
        {
          success: true,
          savedToDb: false,
          message: 'Wallet address received, but DB connection is unavailable on live host.',
          address: trimmedAddress,
        },
        { status: 200 }
      );
    }
  } catch (error: any) {
    console.error('Unhandled error in /api/wallet POST route:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

