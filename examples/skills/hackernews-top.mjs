// contextix skill: Hacker News top stories.
// Keyless — no env vars required.
//
//   contextix ingest mcp ./hackernews-top.mjs

import { defineSkill } from "contextix/skill";

export default defineSkill({
  name: "hackernews-top",
  description: "Top 20 HN stories as events, with the authors as person entities.",
  version: "0.1.0",

  mcpServer: {
    command: "uvx",
    args: ["mcp-hn"],
  },

  defaultDomain: "general",

  async run({ mcp, emit, log }) {
    const result = await mcp.callTool({
      name: "get_stories",
      arguments: { story_type: "top", num_stories: 20 },
    });
    const text = result.content?.find((c) => c.type === "text")?.text ?? "[]";
    let stories;
    try {
      stories = JSON.parse(text);
    } catch {
      log(`could not parse stories: ${text.slice(0, 120)}...`);
      return;
    }

    for (const story of stories) {
      const { title, url, author } = story;
      const points = story.points ?? story.score ?? 0;
      if (!title) continue;

      const detectedAt = new Date().toISOString();

      const event = emit.event({
        title,
        sourceUrl: url ?? `https://news.ycombinator.com/item?id=${story.id}`,
        sourceName: "Hacker News",
        importance: points >= 200 ? "high" : points >= 50 ? "medium" : "low",
        tags: ["hackernews"],
        detectedAt,
        publishedDate: detectedAt,
        data: { points, hnId: story.id },
      });

      if (author) {
        const person = emit.entity({
          entityType: "person",
          name: author,
          aliases: [author],
          domain: "general",
        });
        emit.relation({
          source: event.id,
          target: person.id,
          type: "involves",
          label: `Posted by ${author}`,
          confidence: 1,
          evidence: `HN post #${story.id} by ${author}`,
        });
      }
    }

    log(`emitted ${stories.length} HN stories`);
  },
});
