import { spawn } from 'node:child_process';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

let isInitializing = false;

export async function GET() {
  if (isInitializing) {
    return NextResponse.json({ ok: true, message: 'Theta initialization already in progress' });
  }

  isInitializing = true;

  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'theta-background.js');
    const child = spawn(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
    });

    child.unref();

    return NextResponse.json({ ok: true, message: 'Theta background script started' });
  } catch (error) {
    console.error('Theta endpoint failed:', error);
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : 'Theta endpoint failed' }, { status: 500 });
  } finally {
    isInitializing = false;
  }
}
