import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const minSubs = parseInt(searchParams.get('minSubs') || '0');
  const maxSubs = parseInt(searchParams.get('maxSubs') || '1000000000');
  const minScore = parseInt(searchParams.get('minScore') || '0');
  const monetizedOnly = searchParams.get('monetized') === 'true';
  const ageDays = parseInt(searchParams.get('maxAgeDays') || '1000');
  
  const pool = getPool();
  if (!pool) return NextResponse.json({ error: "DB configuration missing" }, { status: 500 });

  try {
    let query = `
      SELECT c.*, 
        json_agg(json_build_object('video_id', s.video_id, 'thumbnail', s.thumbnail, 'views', s.views, 'title', s.title)) as recent_shorts
      FROM channels c
      LEFT JOIN shorts s ON c.channel_id = s.channel_id
      WHERE c.subscribers >= $1 AND c.subscribers <= $2 AND c.growth_score >= $3 AND c.channel_age_days <= $4
    `;
    const params: any[] = [minSubs, maxSubs, minScore, ageDays];
    
    if (monetizedOnly) {
      query += ` AND c.is_monetized = true`;
    }

    query += ` GROUP BY c.channel_id ORDER BY c.subscribers DESC LIMIT 50`;

    const result = await pool.query(query, params);

    return NextResponse.json({ channels: result.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
