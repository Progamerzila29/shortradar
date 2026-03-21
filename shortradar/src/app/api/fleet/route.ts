import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = getPool();
    
    const query = `
      SELECT 
        c.channel_id,
        c.handle,
        c.subscribers,
        c.scraped_at,
        c.growth_score
      FROM channels c
      ORDER BY c.scraped_at DESC
      LIMIT 50;
    `;
    
    const result = await pool.query(query);

    return NextResponse.json({
      status: 'active',
      latest_acquisitions: result.rows
    });
  } catch (error) {
    console.error("Fleet Engine Error:", error);
    return NextResponse.json({ status: 'error', message: 'Failed to access command network' }, { status: 500 });
  }
}
