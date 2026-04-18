import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig, type ContextixConfig } from "./config.js";
import { LocalJsonStore, type GraphStore } from "./graph/store.js";
import { handleSignals } from "./tools/signals.js";
import { handleWhy } from "./tools/why.js";
import { handleConnect } from "./tools/connect.js";
import { handleEntities } from "./tools/entities.js";
import { handleGraph } from "./tools/graph.js";

export async function startServer(
  overrides?: Partial<ContextixConfig>
): Promise<void> {
  const config = loadConfig(overrides);
  const store: GraphStore = new LocalJsonStore(config.graphFile);

  await store.load();

  const server = new McpServer({
    name: "contextix",
    version: "0.1.0",
  });

  server.tool(
    "contextix_signals",
    "Get recent cross-domain signals. Returns events and their causal relationships across crypto, macro, AI, and other domains.",
    {
      timeframe: z.enum(["1h", "6h", "24h", "7d", "30d"]).default("24h").describe("Time window"),
      domains: z.array(z.string()).optional().describe("Filter by domains"),
      minConfidence: z.number().min(0).max(1).default(0.5).describe("Minimum confidence"),
      limit: z.number().default(20).describe("Max results"),
    },
    async (args) => handleSignals(store, args)
  );

  server.tool(
    "contextix_why",
    "Explain WHY an event happened by tracing causal chains in the signal graph.",
    {
      event: z.string().describe("Event description or ID to explain"),
      depth: z.number().min(1).max(5).default(3).describe("Causal chain depth"),
    },
    async (args) => handleWhy(store, args)
  );

  server.tool(
    "contextix_connect",
    "Find hidden connections between two domains, entities, or topics. Reveals cross-domain causal relationships.",
    {
      from: z.string().describe("First domain, entity, or topic"),
      to: z.string().describe("Second domain, entity, or topic"),
      maxHops: z.number().min(1).max(6).default(4).describe("Max hops"),
    },
    async (args) => handleConnect(store, args)
  );

  server.tool(
    "contextix_entities",
    "Search for entities (people, organizations, tokens, protocols, indicators) in the signal graph.",
    {
      query: z.string().describe("Search query"),
      type: z.enum(["person", "organization", "token", "protocol", "indicator", "policy", "any"]).default("any").describe("Entity type filter"),
      limit: z.number().default(10).describe("Max results"),
    },
    async (args) => handleEntities(store, args)
  );

  server.tool(
    "contextix_graph",
    "Get a raw subgraph around a query. Returns nodes and edges for visualization or analysis.",
    {
      query: z.string().describe("Center query"),
      radius: z.number().min(1).max(4).default(2).describe("Hops from center"),
      maxNodes: z.number().default(50).describe("Max nodes"),
    },
    async (args) => handleGraph(store, args)
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
