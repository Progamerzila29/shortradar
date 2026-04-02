package main

import (
	"fmt"
	"time"
)

// Config holds all tuneable pipeline parameters.
type Config struct {
	// Concurrency
	FeedWorkers    int
	FilterWorkers  int
	TokenQueueSize int
	VideoQueueSize int
	ChanQueueSize  int

	// Channel gate rules
	MaxSubs          int64
	MaxLongVideos    int
	MaxLiveVideos    int
	MinAvgViews      int64
	MinShorts        int
	FirstShortWindow time.Duration

	// HTTP
	RequestTimeout time.Duration
}

// FilterResult is the verdict for a channel.
type FilterResult struct {
	Pass   bool
	Reason string
}

// Qualify checks whether a channel passes all gate rules.
// This is the SINGLE source of truth — no duplication anywhere.
func Qualify(ch ChannelInfo, cfg Config) FilterResult {
	if ch.Subscribers > cfg.MaxSubs {
		return FilterResult{false, fmt.Sprintf("subs %d > %d", ch.Subscribers, cfg.MaxSubs)}
	}
	if ch.LongVideos > cfg.MaxLongVideos {
		return FilterResult{false, fmt.Sprintf("long %d > %d", ch.LongVideos, cfg.MaxLongVideos)}
	}
	if ch.LiveVideos > cfg.MaxLiveVideos {
		return FilterResult{false, fmt.Sprintf("live %d > %d", ch.LiveVideos, cfg.MaxLiveVideos)}
	}
	if ch.ShortCount < cfg.MinShorts {
		return FilterResult{false, fmt.Sprintf("shorts %d < %d", ch.ShortCount, cfg.MinShorts)}
	}
	if ch.AvgViews < cfg.MinAvgViews {
		return FilterResult{false, fmt.Sprintf("avg_views %d < %d", ch.AvgViews, cfg.MinAvgViews)}
	}
	if !ch.FirstShort.IsZero() && time.Since(ch.FirstShort) > cfg.FirstShortWindow {
		return FilterResult{false, fmt.Sprintf("first short too old (%s)", ch.FirstShort.Format("2006-01-02"))}
	}
	return FilterResult{true, ""}
}
