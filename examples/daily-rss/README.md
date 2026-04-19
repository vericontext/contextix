# Daily RSS ingest

Run contextix on a list of feeds once a day. Your graph grows as the news does.

## Setup

```bash
cd examples/daily-rss

# 1. Edit feeds.txt to your taste
# 2. Run the ingest script
./daily-ingest.sh
```

Expected output (per feed):

```
[ingest rss] extractor: agentic
[ingest rss] fetching https://feeds.bloomberg.com/markets/news.rss
[ingest rss] done — events:+8 entities:+12 relations:+19
[ingest rss] tokens — calls:8 errors:0 input:4210 output:1820 cache(write:1842 read:14994, hit:88%)
```

The high cache-hit percentage is Anthropic's prompt cache reusing the
system prompt across items. Cost stays in the cents for a typical batch.

## Schedule it

macOS / Linux — cron:

```bash
crontab -e
```

```
# run every day at 7am local
0 7 * * * /path/to/contextix/examples/daily-rss/daily-ingest.sh >> /tmp/contextix-ingest.log 2>&1
```

macOS — launchd (more modern):

Create `~/Library/LaunchAgents/io.contextix.daily-ingest.plist` pointing
at `daily-ingest.sh` with `<StartCalendarInterval>` at hour 7.

## Query the graph

After a few days you'll have enough signal to ask:

```bash
contextix signals -t 7d --domain crypto
contextix why "<one of the titles from signals output>"
contextix connect "Federal Reserve" "Bitcoin"
```

Or add contextix as an MCP server to Claude Desktop and ask in plain
English — see `../obsidian-vault/README.md` for the config block.

## Feed picking tips

- Quality > quantity. 5 good feeds beat 50 blog-spam feeds.
- Prefer feeds with full-text or strong summaries in `<description>` —
  contextix only sees the text inside the feed, not the article body.
- For full-article depth, chain with `contextix ingest url <link>` per
  item (post-processing, not yet built into rss connector).

Example reliable feeds: CoinDesk, The Block, arXiv cs.AI, Ars Technica.
