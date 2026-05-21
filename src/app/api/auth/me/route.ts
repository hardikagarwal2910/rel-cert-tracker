import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    const userRole = req.headers.get('x-user-role');
    const userName = req.headers.get('x-user-name');
    const userEmail = req.headers.get('x-user-email');

    if (!userId || !userRole || !userName) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      id: userId,
      username: userName,
      role: userRole,
      email: userEmail ?? null,
    });
  } catch {
    return NextResponse.json({ error: 'An internal error occurred' }, { status: 500 });
  }
}
