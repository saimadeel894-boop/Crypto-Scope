import { NextResponse } from 'next/server';
import { isAddress } from 'ethers';
import { saveWalletAddress, getConnectedWallets } from '@/lib/db';

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

    // Save to PostgreSQL connected_wallets table with ON CONFLICT DO UPDATE
    try {
      const savedRecord = await saveWalletAddress(trimmedAddress);
      console.log(`[API /api/wallet] Wallet ${trimmedAddress} successfully saved/updated in connected_wallets table.`);
      return NextResponse.json(
        {
          success: true,
          message: savedRecord.dbStatus === 'unconfigured' 
            ? 'Wallet address received (Database unconfigured on host)'
            : 'Wallet address saved successfully to connected_wallets database table',
          savedToDb: savedRecord.dbStatus !== 'unconfigured',
          data: savedRecord,
        },
        { status: 200 }
      );
    } catch (dbError: any) {
      console.error('Database error in /api/wallet POST route:', dbError);
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

export async function GET() {
  try {
    const wallets = await getConnectedWallets();
    return NextResponse.json({
      success: true,
      count: wallets.length,
      data: wallets,
    });
  } catch (error: any) {
    console.error('Error in /api/wallet GET route:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve connected wallets from database' },
      { status: 500 }
    );
  }
}


