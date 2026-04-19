// contextix skill: recent arXiv AI papers.
// Keyless — arxiv-mcp-server needs no auth.
//
//   contextix ingest mcp ./arxiv-ai.mjs

import { defineSkill } from "contextix/skill";

export default defineSkill({
  name: "arxiv-ai",
  description: "Recent arXiv papers across cs.AI / cs.CL / cs.LG, with authors as person entities.",
  version: "0.1.0",

  mcpServer: {
    command: "uvx",
    args: ["arxiv-mcp-server"],
  },
  defaultDomain: "ai",

  async run({ mcp, emit, log }) {
    const result = await mcp.callTool({
      name: "search_papers",
      arguments: {
        query: "transformer OR agent OR alignment",
        categories: ["cs.AI", "cs.CL", "cs.LG"],
        max_results: 10,
        sort_by: "date",
      },
    });
    const text = result.content?.find((c) => c.type === "text")?.text ?? "[]";
    let papers;
    try {
      papers = JSON.parse(text);
    } catch {
      log(`could not parse papers: ${text.slice(0, 120)}...`);
      return;
    }
    if (!Array.isArray(papers)) {
      papers = papers?.papers ?? papers?.results ?? [];
    }

    for (const paper of papers) {
      const title = paper.title?.trim();
      if (!title) continue;

      const arxivId = paper.id ?? paper.arxiv_id;
      const url = paper.url ?? (arxivId ? `https://arxiv.org/abs/${arxivId}` : "");
      const published = paper.published ?? paper.published_date;

      const event = emit.event({
        title: `Paper: ${title}`,
        description: paper.summary ?? paper.abstract ?? title,
        sourceUrl: url,
        sourceName: "arXiv",
        importance: "medium",
        tags: ["paper", ...(paper.categories ?? [])],
        publishedDate: published,
        data: { arxivId, authors: paper.authors },
      });

      for (const authorName of paper.authors ?? []) {
        if (!authorName) continue;
        const person = emit.entity({
          entityType: "person",
          name: authorName,
          aliases: [authorName],
          domain: "ai",
        });
        emit.relation({
          source: event.id,
          target: person.id,
          type: "involves",
          label: `Author: ${authorName}`,
          confidence: 1,
          evidence: `arXiv ${arxivId}`,
        });
      }
    }

    log(`emitted ${papers.length} papers`);
  },
});
