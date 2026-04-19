import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Entity, EntityType, Relation, RelationType, SignalEvent } from "../graph/types.js";

/** Args your skill can emit from its run() function. */
export interface EmitEventInput {
  id?: string;
  title: string;
  description?: string;
  domain?: string;
  importance?: SignalEvent["importance"];
  confidence?: number;
  tags?: string[];
  detectedAt?: string;
  sourceUrl?: string;
  sourceName?: string;
  publishedDate?: string;
  data?: Record<string, unknown>;
}

export interface EmitEntityInput {
  id?: string;
  name: string;
  entityType: EntityType;
  domain?: string;
  aliases?: string[];
  metadata?: Record<string, unknown>;
  firstSeen?: string;
  lastSeen?: string;
}

export interface EmitRelationInput {
  id?: string;
  source: string;
  target: string;
  type: RelationType;
  label: string;
  confidence?: number;
  evidence?: string;
  detectedAt?: string;
  metadata?: Record<string, unknown>;
}

/** What the skill's run() sees. */
export interface SkillContext {
  /** Connected MCP client. Call tools on it. */
  mcp: Client;
  /** Emit a node or edge to the graph fragment being built. */
  emit: SkillEmitAPI;
  /** Resolved env (skill-declared vars only). */
  env: Record<string, string | undefined>;
  /** Logger. All output goes to stderr; stdout is reserved for future piping. */
  log: (msg: string) => void;
}

export interface SkillEmitAPI {
  event: (input: EmitEventInput) => SignalEvent;
  entity: (input: EmitEntityInput) => Entity;
  relation: (input: EmitRelationInput) => Relation;
}

/** MCP server launch config. Matches a `.mcp.json` entry shape. */
export interface McpServerSpec {
  /** Command to spawn. E.g. "npx". */
  command: string;
  /** Arguments to pass. E.g. ["-y", "@coingecko/coingecko-mcp"]. */
  args?: string[];
  /** Env vars to inject. Values can reference process.env via ${VAR}. */
  env?: Record<string, string>;
}

export interface SkillDefinition {
  /** Unique name. Used in ingest logs and dedup keys. */
  name: string;
  /** One-line description. Appears in `contextix skills list` (future). */
  description: string;
  /** Semver-ish. Bump on breaking output changes. */
  version?: string;
  /** How to launch the MCP server. */
  mcpServer: McpServerSpec;
  /** Env vars your skill needs — documents requirements; runner validates. */
  requiredEnv?: string[];
  /** Optional default domain for emitted nodes. */
  defaultDomain?: string;
  /** Imperative work. Called with a connected MCP client + emit helpers. */
  run(ctx: SkillContext): Promise<void>;
}

/**
 * Identity helper — improves type inference when writing skills.
 *
 *   import { defineSkill } from "contextix/skill";
 *   export default defineSkill({
 *     name: "...",
 *     mcpServer: { command: "npx", args: ["-y", "@some/mcp"] },
 *     async run({ mcp, emit }) { ... }
 *   });
 */
export function defineSkill(spec: SkillDefinition): SkillDefinition {
  return spec;
}
