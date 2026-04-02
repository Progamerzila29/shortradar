package main

import (
	"context"
	"log/slog"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"
)

// ─────────────────────────────────────────────────────────────────────────────
//  Pipeline — /search seeding + /next random walk + goroutine channels
//
//  Flow:
//    Boot: /search × 30 niches → seedPool (600+ video IDs)
//    [seedPool] ──► feedWorker (picks seed → /next → related IDs) ──► [videoCh]
//    [videoCh] ──► filterWorker (resolve channel, run gates) ──► [chanCh]
//    [chanCh] ──► dbWriter (upsert to CockroachDB)
//    Background: reseeder adds fresh seeds every 60s
// ─────────────────────────────────────────────────────────────────────────────

type Pipeline struct {
	cfg  Config
	db   *DB

	videoCh chan string      // video IDs to check
	chanCh  chan ChannelInfo // qualified channels to store

	// Seed pool (thread-safe)
	seedMu   sync.Mutex
	seedPool []string

	// Dedup
	seenVideos   sync.Map
	seenChannels sync.Map

	// Stats
	statFetched  atomic.Int64
	statFiltered atomic.Int64
	statSaved    atomic.Int64
	statErrors   atomic.Int64
	startedAt    time.Time
}

var geoRotation = []string{"US", "GB", "FR", "CA", "AU", "DE"}

func NewPipeline(cfg Config, db *DB) *Pipeline {
	return &Pipeline{
		cfg:       cfg,
		db:        db,
		videoCh:   make(chan string, cfg.VideoQueueSize),
		chanCh:    make(chan ChannelInfo, cfg.ChanQueueSize),
		startedAt: time.Now(),
	}
}

// Run starts all goroutines and blocks until ctx is cancelled.
func (p *Pipeline) Run(ctx context.Context) {
	// ── Phase 1: Seed from 30 diverse niche /search queries ──────────────
	p.loadSeeds()
	if len(p.seedPool) == 0 {
		slog.Error("💀 Zero seeds found. Cannot start.")
		return
	}
	slog.Info("🌱 Seed pool ready", "count", len(p.seedPool))

	var wg sync.WaitGroup

	// ── Feed workers (random walk via /next) ──────────────────────────────
	for i := 0; i < p.cfg.FeedWorkers; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			p.feedWorker(ctx, id)
		}(i)
	}

	// ── Filter workers ────────────────────────────────────────────────────
	for i := 0; i < p.cfg.FilterWorkers; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			p.filterWorker(ctx, id)
		}(i)
	}

	// ── DB writer ─────────────────────────────────────────────────────────
	wg.Add(1)
	go func() {
		defer wg.Done()
		p.dbWriter(ctx)
	}()

	// ── Reseeder (adds fresh seeds every 60s) ─────────────────────────────
	wg.Add(1)
	go func() {
		defer wg.Done()
		p.reseeder(ctx)
	}()

	// ── Stats printer ─────────────────────────────────────────────────────
	wg.Add(1)
	go func() {
		defer wg.Done()
		p.statsPrinter(ctx)
	}()

	wg.Wait()
}

// ─────────────────────────────────────────────────────────────────────────────
//  loadSeeds — /search × 30 niche queries to build initial seed pool
// ─────────────────────────────────────────────────────────────────────────────

func (p *Pipeline) loadSeeds() {
	slog.Info("🌱 Seeding from niche queries...", "niches", len(NicheQueries))

	for i := 0; i < len(NicheQueries); i += 5 {
		end := i + 5
		if end > len(NicheQueries) {
			end = len(NicheQueries)
		}

		var wg sync.WaitGroup
		var mu sync.Mutex
		batch := NicheQueries[i:end]

		for _, q := range batch {
			wg.Add(1)
			go func(query string) {
				defer wg.Done()
				result, err := SearchShorts(query)
				if err != nil {
					return
				}
				mu.Lock()
				for _, id := range result.VideoIDs {
					p.seedPool = append(p.seedPool, id)
				}
				mu.Unlock()
			}(q)
		}
		wg.Wait()

		slog.Info("  🌱 batch done", "batch", (i/5)+1, "pool", len(p.seedPool))
		time.Sleep(300 * time.Millisecond)
	}
}

func (p *Pipeline) pickSeed() string {
	p.seedMu.Lock()
	defer p.seedMu.Unlock()
	if len(p.seedPool) == 0 {
		return ""
	}
	return p.seedPool[rand.Intn(len(p.seedPool))]
}

func (p *Pipeline) addSeeds(ids []string) {
	p.seedMu.Lock()
	defer p.seedMu.Unlock()
	for _, id := range ids {
		p.seedPool = append(p.seedPool, id)
	}
	// Cap at 3000
	if len(p.seedPool) > 3000 {
		p.seedPool = p.seedPool[len(p.seedPool)-3000:]
	}
}

// ─────────────────────────────────────────────────────────────────────────────
//  Feed worker — picks a seed, calls /next, emits related video IDs
// ─────────────────────────────────────────────────────────────────────────────

func (p *Pipeline) feedWorker(ctx context.Context, id int) {
	gl := geoRotation[id%len(geoRotation)]
	seed := p.pickSeed()
	backoff := time.Second

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		if seed == "" {
			seed = p.pickSeed()
			if seed == "" {
				time.Sleep(2 * time.Second)
				continue
			}
		}

		result, err := NextRelated(seed, gl)
		if err != nil {
			p.statErrors.Add(1)
			seed = p.pickSeed()
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return
			}
			if backoff < 32*time.Second {
				backoff *= 2
			}
			continue
		}
		backoff = time.Second

		if len(result.VideoIDs) == 0 {
			seed = p.pickSeed()
			time.Sleep(2 * time.Second)
			continue
		}

		for _, vid := range result.VideoIDs {
			if _, loaded := p.seenVideos.LoadOrStore(vid, struct{}{}); loaded {
				continue
			}
			p.statFetched.Add(1)
			select {
			case p.videoCh <- vid:
			case <-ctx.Done():
				return
			}
		}

		// Random walk: pick next seed from results
		seed = result.VideoIDs[rand.Intn(len(result.VideoIDs))]
		time.Sleep(200*time.Millisecond + time.Duration(rand.Intn(300))*time.Millisecond)
	}
}

// ─────────────────────────────────────────────────────────────────────────────
//  Filter worker — resolves channel from video, runs qualification gates
// ─────────────────────────────────────────────────────────────────────────────

func (p *Pipeline) filterWorker(ctx context.Context, id int) {
	for {
		select {
		case <-ctx.Done():
			return
		case videoID := <-p.videoCh:
			ch, err := FetchChannelFromVideo(videoID)
			if err != nil {
				p.statErrors.Add(1)
				continue
			}

			if _, loaded := p.seenChannels.LoadOrStore(ch.ID, struct{}{}); loaded {
				continue
			}

			if p.db.AlreadySeen(ctx, ch.ID) {
				continue
			}

			verdict := Qualify(ch, p.cfg)
			if !verdict.Pass {
				p.statFiltered.Add(1)
				slog.Info("  ✗", "channel", ch.Name, "reason", verdict.Reason)
				continue
			}

			select {
			case p.chanCh <- ch:
			case <-ctx.Done():
				return
			}
		}
	}
}

// ─────────────────────────────────────────────────────────────────────────────
//  DB writer — persists qualified channels
// ─────────────────────────────────────────────────────────────────────────────

func (p *Pipeline) dbWriter(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case ch := <-p.chanCh:
			if err := p.db.Upsert(ctx, ch); err != nil {
				p.statErrors.Add(1)
				slog.Error("DB error", "channel", ch.Name, "err", err)
				continue
			}
			p.statSaved.Add(1)
			slog.Info("✅ SAVED",
				"channel", ch.Name,
				"subs", ch.Subscribers,
				"shorts", ch.ShortCount,
				"avgViews", ch.AvgViews,
				"long", ch.LongVideos,
				"live", ch.LiveVideos,
			)
		}
	}
}

// ─────────────────────────────────────────────────────────────────────────────
//  Reseeder — adds fresh seeds from a random niche every 60s
// ─────────────────────────────────────────────────────────────────────────────

func (p *Pipeline) reseeder(ctx context.Context) {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			q := RandomQuery()
			result, err := SearchShorts(q)
			if err != nil {
				continue
			}
			p.addSeeds(result.VideoIDs)
			slog.Info("🔄 Reseed", "query", q, "added", len(result.VideoIDs), "pool", len(p.seedPool))
		}
	}
}

// ─────────────────────────────────────────────────────────────────────────────
//  Stats printer
// ─────────────────────────────────────────────────────────────────────────────

func (p *Pipeline) statsPrinter(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			elapsed := time.Since(p.startedAt).Minutes()
			fetched := p.statFetched.Load()
			saved := p.statSaved.Load()
			filtered := p.statFiltered.Load()
			errors := p.statErrors.Load()

			ratePerMin := float64(0)
			if elapsed > 0 {
				ratePerMin = float64(fetched) / elapsed
			}

			slog.Info("📊 Stats",
				"fetched", fetched,
				"saved", saved,
				"filtered", filtered,
				"errors", errors,
				"rate/min", int(ratePerMin),
				"seeds", len(p.seedPool),
				"videoCh", len(p.videoCh),
			)
		}
	}
}
