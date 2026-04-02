package main

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DB wraps a CockroachDB connection pool.
type DB struct {
	pool *pgxpool.Pool
}

// NewDB opens a connection pool to CockroachDB.
func NewDB(ctx context.Context, dsn string) (*DB, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, err
	}
	cfg.MaxConns = 10
	cfg.MinConns = 2

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, err
	}
	return &DB{pool: pool}, nil
}

func (db *DB) Close() { db.pool.Close() }

// Migrate creates the table if it doesn't exist.
func (db *DB) Migrate(ctx context.Context) error {
	_, err := db.pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS channels (
			channel_id      TEXT PRIMARY KEY,
			channel_name    TEXT        NOT NULL,
			subscribers     BIGINT      NOT NULL,
			short_count     INT         NOT NULL,
			avg_views       BIGINT      NOT NULL,
			long_videos     INT         NOT NULL DEFAULT 0,
			live_videos     INT         NOT NULL DEFAULT 0,
			first_short_at  TIMESTAMPTZ,
			discovered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`)
	return err
}

// Upsert inserts or updates a qualified channel.
func (db *DB) Upsert(ctx context.Context, ch ChannelInfo) error {
	var firstShort *time.Time
	if !ch.FirstShort.IsZero() {
		firstShort = &ch.FirstShort
	}

	_, err := db.pool.Exec(ctx, `
		INSERT INTO channels
			(channel_id, channel_name, subscribers, short_count, avg_views, long_videos, live_videos, first_short_at)
		VALUES
			($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (channel_id) DO UPDATE SET
			channel_name   = EXCLUDED.channel_name,
			subscribers    = EXCLUDED.subscribers,
			short_count    = EXCLUDED.short_count,
			avg_views      = EXCLUDED.avg_views,
			long_videos    = EXCLUDED.long_videos,
			live_videos    = EXCLUDED.live_videos,
			first_short_at = EXCLUDED.first_short_at,
			discovered_at  = NOW()
	`,
		ch.ID, ch.Name, ch.Subscribers, ch.ShortCount, ch.AvgViews, ch.LongVideos, ch.LiveVideos, firstShort,
	)
	return err
}

// AlreadySeen returns true if the channel is already in the DB.
func (db *DB) AlreadySeen(ctx context.Context, channelID string) bool {
	var exists bool
	db.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM channels WHERE channel_id = $1)`, channelID).Scan(&exists)
	return exists
}
