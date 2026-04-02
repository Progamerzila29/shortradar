package main

import (
	"bytes"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	gojson "github.com/goccy/go-json"
)

// ─────────────────────────────────────────────────────────────────────────────
//  Client profiles — rotated to avoid fingerprinting
// ─────────────────────────────────────────────────────────────────────────────

type itClient struct {
	name       string
	clientName string
	version    string
	userAgent  string
	apiKey     string
}

var itClients = []itClient{
	{
		name:       "WEB",
		clientName: "WEB",
		version:    "2.20240401.00.00",
		userAgent:  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
		apiKey:     "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
	},
	{
		name:       "MWEB",
		clientName: "MWEB",
		version:    "2.20231207.01.00",
		userAgent:  "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
		apiKey:     "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
	},
	{
		name:       "ANDROID",
		clientName: "ANDROID",
		version:    "19.09.37",
		userAgent:  "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip",
		apiKey:     "AIzaSyA8eiZmM1fanX9Dx2aqkjoR0_UZHj0VUqY",
	},
}

func mwebClient() itClient  { return itClients[1] }
func webClient() itClient   { return itClients[0] }

// ─────────────────────────────────────────────────────────────────────────────
//  HTTP client (shared, connection-pooled, HTTP/2-ready)
// ─────────────────────────────────────────────────────────────────────────────

var httpClient = &http.Client{
	Timeout: 12 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        200,
		MaxIdleConnsPerHost: 100,
		IdleConnTimeout:     90 * time.Second,
		ForceAttemptHTTP2:   true,
	},
}

func itPost(endpoint string, body map[string]any, c itClient) (map[string]any, error) {
	url := fmt.Sprintf("https://www.youtube.com/youtubei/v1/%s?key=%s&prettyPrint=false", endpoint, c.apiKey)

	body["context"] = map[string]any{
		"client": map[string]any{
			"clientName":    c.clientName,
			"clientVersion": c.version,
			"hl":            "en",
			"gl":            "US",
		},
	}

	raw, err := gojson.Marshal(body)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", c.userAgent)
	req.Header.Set("Origin", "https://www.youtube.com")
	req.Header.Set("Referer", "https://www.youtube.com/shorts/")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result map[string]any
	if err := gojson.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// ─────────────────────────────────────────────────────────────────────────────
//  SEARCH-BASED SEEDING (replaces blocked FEshorts browse)
//
//  Uses /search with YouTube's actual Shorts filter param (CAMSBAgEEAk=)
//  confirmed working from Codespace IPs. Rotates through 30 niche queries.
// ─────────────────────────────────────────────────────────────────────────────

var NicheQueries = []string{
	"shorts funny moments", "shorts cooking recipe", "shorts workout gym",
	"shorts scary story", "shorts car race", "shorts travel vlog",
	"shorts makeup tutorial", "shorts gaming clips", "shorts soccer goals",
	"shorts guitar music", "shorts street food", "shorts prank",
	"shorts life hack", "shorts satisfying", "shorts motivational",
	"shorts dance trend", "shorts cat dog pet", "shorts magic trick",
	"shorts drawing art", "shorts science experiment", "shorts fashion",
	"shorts basketball dunk", "shorts nature wildlife", "shorts comedy skit",
	"shorts singing voice", "shorts cleaning asmr", "shorts drone footage",
	"shorts boxing fight", "shorts baking cake", "shorts fishing catch",
}

type FeedResult struct {
	VideoIDs  []string
	NextToken string
}

// SearchShorts calls /search with the YouTube website's actual Shorts filter.
// Returns video IDs from a random niche query.
func SearchShorts(query string) (FeedResult, error) {
	c := mwebClient()

	body := map[string]any{
		"query":  query,
		"params": "CAMSBAgEEAk%3D", // YouTube website's Shorts filter
	}

	data, err := itPost("search", body, c)
	if err != nil {
		return FeedResult{}, err
	}

	ids := extractVideoIDs(data)
	return FeedResult{VideoIDs: ids}, nil
}

// NextRelated calls /next (MWEB) to get related Shorts from a seed video.
// This is the random-walk engine: seed → /next → 60 related Shorts.
func NextRelated(videoID string, gl string) (FeedResult, error) {
	c := mwebClient()
	body := map[string]any{
		"videoId": videoID,
		"params":  "8gEAmgMDCNkI",
	}
	// Override gl
	body["context"] = map[string]any{
		"client": map[string]any{
			"clientName":    c.clientName,
			"clientVersion": c.version,
			"hl":            "en",
			"gl":            gl,
		},
	}

	data, err := itPost("next", body, c)
	if err != nil {
		return FeedResult{}, err
	}

	ids := extractVideoIDs(data)
	return FeedResult{VideoIDs: ids}, nil
}

// ─────────────────────────────────────────────────────────────────────────────
//  Channel info via /next + /browse (replaces blocked /player)
// ─────────────────────────────────────────────────────────────────────────────

type ChannelInfo struct {
	ID          string
	Name        string
	Subscribers int64
	LongVideos  int
	LiveVideos  int
	ShortCount  int
	AvgViews    int64
	FirstShort  time.Time
}

// FetchChannelFromVideo — uses /next (MWEB) to extract channelId
// instead of /player which is blocked from Codespace IPs.
func FetchChannelFromVideo(videoID string) (ChannelInfo, error) {
	c := mwebClient()

	body := map[string]any{
		"videoId": videoID,
	}
	data, err := itPost("next", body, c)
	if err != nil {
		return ChannelInfo{}, err
	}

	// Extract channelId from /next response (first UC... match)
	raw, _ := gojson.Marshal(data)
	channelID := extractFirstChannelID(string(raw))
	if channelID == "" {
		return ChannelInfo{}, fmt.Errorf("no channelId for video %s", videoID)
	}

	return FetchChannelByID(channelID)
}

var channelIDRe = regexp.MustCompile(`"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"`)

func extractFirstChannelID(raw string) string {
	m := channelIDRe.FindStringSubmatch(raw)
	if m == nil {
		return ""
	}
	return m[1]
}

// FetchChannelByID — browse channel page + Shorts tab.
func FetchChannelByID(channelID string) (ChannelInfo, error) {
	c := webClient()

	// ── Step 1: Channel home (subs + name) ───────────────────────────────
	home, err := itPost("browse", map[string]any{"browseId": channelID}, c)
	if err != nil {
		return ChannelInfo{}, err
	}

	name := deepStr(home, "metadata", "channelMetadataRenderer", "title")
	subsText := findFirst(home, "subscriberCountText")
	subs := parseCount(subsText)

	info := ChannelInfo{
		ID:          channelID,
		Name:        name,
		Subscribers: subs,
	}

	// ── Step 2: Videos tab — count long + live ────────────────────────────
	videosData, err := itPost("browse", map[string]any{
		"browseId": channelID,
		"params":   "EgZ2aWRlb3PyBgQKAjoA",
	}, c)
	if err == nil {
		info.LongVideos, info.LiveVideos = countLongAndLive(videosData)
	}

	// ── Step 3: Shorts tab — count + views + first date ──────────────────
	shortsData, err := itPost("browse", map[string]any{
		"browseId": channelID,
		"params":   "EgZzaG9ydHPyBgUKA5oBAA%3D%3D",
	}, c)
	if err == nil {
		info.ShortCount, info.AvgViews, info.FirstShort = parseShortStats(shortsData)
	}

	return info, nil
}

// ─────────────────────────────────────────────────────────────────────────────
//  Parsers (recursive, tolerant of YouTube JSON structure changes)
// ─────────────────────────────────────────────────────────────────────────────

func extractVideoIDs(data map[string]any) []string {
	var ids []string
	var walk func(v any)
	walk = func(v any) {
		switch val := v.(type) {
		case map[string]any:
			if id, ok := val["videoId"].(string); ok && len(id) == 11 {
				ids = append(ids, id)
			}
			for _, child := range val {
				walk(child)
			}
		case []any:
			for _, item := range val {
				walk(item)
			}
		}
	}
	walk(data)
	seen := map[string]bool{}
	unique := ids[:0]
	for _, id := range ids {
		if !seen[id] {
			seen[id] = true
			unique = append(unique, id)
		}
	}
	return unique
}

func findFirst(v any, key string) string {
	switch val := v.(type) {
	case map[string]any:
		if s, ok := val[key].(string); ok {
			return s
		}
		if m, ok := val[key].(map[string]any); ok {
			if s, ok := m["simpleText"].(string); ok {
				return s
			}
			if runs, ok := m["runs"].([]any); ok && len(runs) > 0 {
				if r, ok := runs[0].(map[string]any); ok {
					if s, ok := r["text"].(string); ok {
						return s
					}
				}
			}
		}
		for _, child := range val {
			if s := findFirst(child, key); s != "" {
				return s
			}
		}
	case []any:
		for _, item := range val {
			if s := findFirst(item, key); s != "" {
				return s
			}
		}
	}
	return ""
}

func deepStr(m map[string]any, keys ...string) string {
	var cur any = m
	for _, k := range keys {
		mm, ok := cur.(map[string]any)
		if !ok {
			return ""
		}
		cur = mm[k]
	}
	s, _ := cur.(string)
	return s
}

var countRe = regexp.MustCompile(`[\d,.]+`)

func parseCount(s string) int64 {
	s = strings.ToUpper(s)
	multiplier := int64(1)
	if strings.Contains(s, "K") {
		multiplier = 1_000
	} else if strings.Contains(s, "M") {
		multiplier = 1_000_000
	} else if strings.Contains(s, "B") {
		multiplier = 1_000_000_000
	}

	m := countRe.FindString(s)
	if m == "" {
		return 0
	}
	m = strings.ReplaceAll(m, ",", "")
	f, err := strconv.ParseFloat(m, 64)
	if err != nil {
		return 0
	}
	return int64(f * float64(multiplier))
}

func countLongAndLive(data map[string]any) (long, live int) {
	var walk func(v any)
	walk = func(v any) {
		switch val := v.(type) {
		case map[string]any:
			if _, hasOverlay := val["thumbnailOverlayTimeStatusRenderer"]; hasOverlay {
				overlay := val["thumbnailOverlayTimeStatusRenderer"].(map[string]any)
				style, _ := overlay["style"].(string)
				switch style {
				case "LIVE":
					live++
				case "DEFAULT":
					if text := findFirst(overlay, "text"); text != "" {
						long++
					}
				}
			}
			for _, child := range val {
				walk(child)
			}
		case []any:
			for _, item := range val {
				walk(item)
			}
		}
	}
	walk(data)
	return
}

func parseShortStats(data map[string]any) (count int, avgViews int64, firstShort time.Time) {
	var viewsTotal int64
	var oldest time.Time

	var walk func(v any)
	walk = func(v any) {
		switch val := v.(type) {
		case map[string]any:
			if vid, ok := val["videoId"].(string); ok && vid != "" {
				count++
				viewText := findFirst(val, "viewCountText")
				if viewText == "" {
					viewText = findFirst(val, "shortViewCountText")
				}
				viewsTotal += parseCount(viewText)

				pubText := findFirst(val, "publishedTimeText")
				t := parseRelativeDate(pubText)
				if !t.IsZero() && (oldest.IsZero() || t.Before(oldest)) {
					oldest = t
				}
			}
			for _, child := range val {
				walk(child)
			}
		case []any:
			for _, item := range val {
				walk(item)
			}
		}
	}
	walk(data)

	if count > 0 {
		avgViews = viewsTotal / int64(count)
	}
	firstShort = oldest
	return
}

var relativeRe = regexp.MustCompile(`(\d+)\s+(second|minute|hour|day|week|month|year)`)

func parseRelativeDate(s string) time.Time {
	if s == "" {
		return time.Time{}
	}
	m := relativeRe.FindStringSubmatch(strings.ToLower(s))
	if m == nil {
		return time.Time{}
	}
	n, _ := strconv.Atoi(m[1])
	now := time.Now()
	switch {
	case strings.HasPrefix(m[2], "second"):
		return now.Add(-time.Duration(n) * time.Second)
	case strings.HasPrefix(m[2], "minute"):
		return now.Add(-time.Duration(n) * time.Minute)
	case strings.HasPrefix(m[2], "hour"):
		return now.Add(-time.Duration(n) * time.Hour)
	case strings.HasPrefix(m[2], "day"):
		return now.AddDate(0, 0, -n)
	case strings.HasPrefix(m[2], "week"):
		return now.AddDate(0, 0, -n*7)
	case strings.HasPrefix(m[2], "month"):
		return now.AddDate(0, -n, 0)
	case strings.HasPrefix(m[2], "year"):
		return now.AddDate(-n, 0, 0)
	}
	return time.Time{}
}

// RandomQuery returns a random niche query for search seeding.
func RandomQuery() string {
	return NicheQueries[rand.Intn(len(NicheQueries))]
}
