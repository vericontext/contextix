# Recording the README demo GIF

The Show HN landing relies on a 15–20s demo at the top of `README.md`.
This file is the recipe.

## Prerequisites

```bash
brew install asciinema
cargo install --git https://github.com/asciinema/agg
# or: brew install agg   (if your Homebrew has it)
```

## One-shot record

From the repo root:

```bash
# 1. Start a fresh graph so demo numbers are clean
rm -rf ~/.contextix

# 2. Record
asciinema rec /tmp/contextix-demo.cast \
  -c "bash scripts/demo-run.sh" \
  --title "contextix demo" \
  --idle-time-limit 1

# 3. Convert to GIF
agg /tmp/contextix-demo.cast public/demo.gif \
  --speed 1.2 \
  --theme monokai \
  --font-size 18
```

Then embed in `README.md` right after the H1:

```markdown
![Demo](./public/demo.gif)
```

## Script: `scripts/demo-run.sh`

Lives in this repo. Runs three commands with timed pauses so the GIF
reads naturally:

```bash
bash scripts/demo-run.sh
```

It does:

1. `contextix ingest rss https://news.ycombinator.com/rss --max 5` (2s pause)
2. `contextix signals -t 24h` (3s pause)
3. `contextix why "<first event title from signals>"` (3s pause)

## Guidelines

- **Terminal size**: set to 80 columns before recording. GIF width sits
  well in README cards.
- **Font**: match `agg` default or use a readable mono font (JetBrains
  Mono, Fira Code).
- **Total length**: aim under 20s. Trim by dropping `--max` lower or
  cutting the third command.
- **Avoid**: API-key output, long error traces, unnecessary `ls` or
  `pwd`. Clean feed.
- **First frame**: no pre-existing shell prompt clutter. Use a fresh
  terminal.

## After recording

- Inspect the GIF visually at its embedded size — anything smaller than
  14pt mono is unreadable in the README.
- Commit `public/demo.gif` (not the `.cast` file — huge).
- File size target: <2 MB. If bigger, reduce frame rate or length.

## Alternatives

If asciinema doesn't work on your setup:

- **OBS Studio** → `ffmpeg` to GIF — higher quality but bigger files
- **Kap** (macOS) or **Licecap** — simpler GUI recorders
- **Vercel OG** — a static "screenshot with code" image is better than
  no demo, but GIF always outperforms static on front-page HN.

## Platform-side screenshot

If you also want the Claude Desktop MCP screenshot for the README's
later section, that's a separate recording — don't try to combine them
in one GIF.
