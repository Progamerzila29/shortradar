import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "DB configuration missing" }, { status: 500 });

  try {
    const totalQuery = await pool.query('SELECT COUNT(*) FROM channels');
    const monetizedQuery = await pool.query('SELECT COUNT(*) FROM channels WHERE is_monetized = true');
    // Using scraped_at as a fallback for today if created_at doesn't exist.
    // However, channel_age_days < 7 can also mean "new" channels
    const todayQuery = await pool.query(`SELECT COUNT(*) FROM channels WHERE channel_age_days <= 7`);

    return NextResponse.json({
      total: parseInt(totalQuery.rows[0].count),
      monetized: parseInt(monetizedQuery.rows[0].count),
      new_this_week: parseInt(todayQuery.rows[0].count)
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
