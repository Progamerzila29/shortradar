package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	// Structured logging with slog (Go 1.21+)
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		slog.Error("DATABASE_URL not set")
		os.Exit(1)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	// ── Database ──────────────────────────────────────────────────────────
	db, err := NewDB(ctx, dbURL)
	if err != nil {
		slog.Error("CockroachDB connection failed", "err", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := db.Migrate(ctx); err != nil {
		slog.Error("Migration failed", "err", err)
		os.Exit(1)
	}
	slog.Info("✅ CockroachDB connected")

	// ── Pipeline config ───────────────────────────────────────────────────
	cfg := Config{
		FeedWorkers:    16,
		FilterWorkers:  32,
		TokenQueueSize: 512,
		VideoQueueSize: 4096,
		ChanQueueSize:  256,

		MaxSubs:          100_000,
		MaxLongVideos:    0,
		MaxLiveVideos:    0,
		MinAvgViews:      10_000,
		MinShorts:        3,
		FirstShortWindow: 90 * 24 * time.Hour,

		RequestTimeout: 12 * time.Second,
	}

	slog.Info("🚀 ShortRadar Go", "feedWorkers", cfg.FeedWorkers, "filterWorkers", cfg.FilterWorkers)
	NewPipeline(cfg, db).Run(ctx)
	slog.Info("👋 Shutdown complete")
}
