import { createHash } from "crypto";
import { pathToFileURL } from "url";
import { resolve, isAbsolute } from "path";
import { existsSync } from "fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type {
  Entity,
  EntityType,
  Relation,
  RelationType,
  SignalEvent,
} from "../graph/types.js";
import type {
  EmitEntityInput,
  EmitEventInput,
  EmitRelationInput,
  SkillContext,
  SkillDefinition,
  SkillEmitAPI,
} from "../skill/types.js";
import type { GraphFragment } from "./merge.js";

export interface IngestMcpOptions {
  domainHint?: string;
  skillPath: string;
  extraEnv?: Record<string, string>;
}

const PKG_NAME = "contextix";
const PKG_VERSION = "0.3.0";

export async function ingestMcp(opts: IngestMcpOptions): Promise<GraphFragment> {
  const skill = await loadSkill(opts.skillPath);
  const resolvedEnv = resolveEnv(skill, opts.extraEnv ?? {});

  validateRequiredEnv(skill, resolvedEnv);

  const transport = new StdioClientTransport({
    command: skill.mcpServer.command,
    args: skill.mcpServer.args ?? [],
    env: { ...process.env, ...resolvedEnv } as Record<string, string>,
    stderr: "inherit",
  });

  const client = new Client({ name: PKG_NAME, version: PKG_VERSION }, { capabilities: {} });

  let fragment: GraphFragment;
  try {
    await client.connect(transport);

    const collector = newCollector();
    const ctx: SkillContext = {
      mcp: client,
      emit: collector.emit,
      env: resolvedEnv,
      log: (msg) => console.error(`[skill ${skill.name}] ${msg}`),
    };

    await skill.run(ctx);
    fragment = {
      events: collector.events,
      entities: collector.entities,
      relations: collector.relations,
      summary: `Ingested via skill ${skill.name} (${collector.events.length} events, ${collector.entities.length} entities, ${collector.relations.length} relations)`,
    };
  } finally {
    try {
      await client.close();
    } catch {
      // ignore close errors
    }
  }

  if (opts.domainHint) {
    for (const event of fragment.events ?? []) event.domain = opts.domainHint;
    for (const entity of fragment.entities ?? []) entity.domain = opts.domainHint;
  }

  return fragment;
}

// ----- Skill loading -----

async function loadSkill(skillPath: string): Promise<SkillDefinition> {
  const resolved = resolveSkillPath(skillPath);
  if (!existsSync(resolved)) {
    throw new Error(`Skill not found: ${skillPath} (resolved: ${resolved})`);
  }
  const mod = await import(pathToFileURL(resolved).href);
  const skill = (mod.default ?? mod.skill ?? mod) as SkillDefinition;
  validateSkill(skill);
  return skill;
}

function resolveSkillPath(skillPath: string): string {
  if (isAbsolute(skillPath)) return skillPath;
  if (skillPath.startsWith("./") || skillPath.startsWith("../")) {
    return resolve(process.cwd(), skillPath);
  }
  // Bare name — try cwd first, then ~/.contextix/skills/
  const localGuess = resolve(process.cwd(), skillPath);
  if (existsSync(localGuess)) return localGuess;
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  const withExts = [skillPath, `${skillPath}.mjs`, `${skillPath}.js`];
  for (const candidate of withExts) {
    const full = resolve(home, ".contextix", "skills", candidate);
    if (existsSync(full)) return full;
  }
  return resolve(process.cwd(), skillPath);
}

function validateSkill(skill: unknown): asserts skill is SkillDefinition {
  if (!skill || typeof skill !== "object") {
    throw new Error("Skill module must export a default object (use defineSkill).");
  }
  const s = skill as Record<string, unknown>;
  if (typeof s.name !== "string" || !s.name) throw new Error("Skill missing `name`.");
  if (typeof s.run !== "function") throw new Error("Skill missing `run(ctx)`.");
  const ms = s.mcpServer as Record<string, unknown> | undefined;
  if (!ms || typeof ms.command !== "string") {
    throw new Error("Skill missing `mcpServer.command`.");
  }
}

function resolveEnv(
  skill: SkillDefinition,
  extra: Record<string, string>
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(skill.mcpServer.env ?? {})) {
    out[k] = interpolateEnv(v, extra);
  }
  for (const [k, v] of Object.entries(extra)) {
    out[k] = v;
  }
  return out;
}

function interpolateEnv(value: string, extra: Record<string, string>): string {
  return value.replace(/\$\{([A-Z0-9_]+)\}|\$([A-Z0-9_]+)/gi, (_m, a, b) => {
    const key = a ?? b;
    return extra[key] ?? process.env[key] ?? "";
  });
}

function validateRequiredEnv(
  skill: SkillDefinition,
  env: Record<string, string | undefined>
): void {
  const missing = (skill.requiredEnv ?? []).filter(
    (k) => !env[k] && !process.env[k]
  );
  if (missing.length > 0) {
    throw new Error(
      `Skill ${skill.name} requires env vars not set: ${missing.join(", ")}`
    );
  }
}

// ----- Emit collector -----

interface Collector {
  events: SignalEvent[];
  entities: Entity[];
  relations: Relation[];
  emit: SkillEmitAPI;
}

function newCollector(): Collector {
  const events: SignalEvent[] = [];
  const entities: Entity[] = [];
  const relations: Relation[] = [];
  const entityIdByKey = new Map<string, string>();
  const eventIds = new Set<string>();
  const relationIds = new Set<string>();

  const emit: SkillEmitAPI = {
    event(input: EmitEventInput): SignalEvent {
      const detectedAt = input.detectedAt ?? new Date().toISOString();
      const sourceUrl = input.sourceUrl ?? "";
      const id = input.id ?? makeEventId(sourceUrl, input.title);
      if (eventIds.has(id)) {
        return events.find((e) => e.id === id)!;
      }
      const event: SignalEvent = {
        id,
        type: "event",
        domain: input.domain ?? "general",
        title: input.title,
        description: input.description ?? input.title,
        detectedAt,
        importance: input.importance ?? "medium",
        confidence: input.confidence ?? 0.7,
        sources: [
          {
            name: input.sourceName ?? "mcp",
            url: sourceUrl,
            publishedDate: input.publishedDate,
          },
        ],
        tags: input.tags ?? [],
        data: input.data,
      };
      events.push(event);
      eventIds.add(id);
      return event;
    },

    entity(input: EmitEntityInput): Entity {
      const key = input.id ?? `${input.entityType}:${canonicalize(input.name)}`;
      if (entityIdByKey.has(key)) {
        return entities.find((e) => e.id === entityIdByKey.get(key))!;
      }
      const now = new Date().toISOString();
      const entity: Entity = {
        id: key,
        type: "entity",
        entityType: input.entityType as EntityType,
        name: canonicalize(input.name),
        aliases: dedupe([input.name, ...(input.aliases ?? [])].filter(Boolean)),
        domain: input.domain ?? "general",
        metadata: input.metadata,
        firstSeen: input.firstSeen ?? now,
        lastSeen: input.lastSeen ?? now,
      };
      entities.push(entity);
      entityIdByKey.set(key, key);
      return entity;
    },

    relation(input: EmitRelationInput): Relation {
      const src = normalizeId(input.source);
      const tgt = normalizeId(input.target);
      const id = input.id ?? makeRelationId(src, tgt, input.type);
      if (relationIds.has(id)) {
        return relations.find((r) => r.id === id)!;
      }
      const relation: Relation = {
        id,
        source: src,
        target: tgt,
        type: input.type as RelationType,
        label: input.label,
        confidence: input.confidence ?? 0.7,
        evidence: input.evidence ?? "",
        detectedAt: input.detectedAt ?? new Date().toISOString(),
        metadata: input.metadata,
      };
      relations.push(relation);
      relationIds.add(id);
      return relation;
    },
  };

  return { events, entities, relations, emit };
}

function canonicalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeId(id: string): string {
  return id.includes(":") ? id : id.toLowerCase().replace(/\s+/g, "_");
}

function dedupe<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function makeEventId(sourceUrl: string, title: string): string {
  const h = createHash("sha1").update(`${sourceUrl}::${title}`).digest("hex").slice(0, 12);
  return `event:${h}`;
}

function makeRelationId(source: string, target: string, type: string): string {
  const h = createHash("sha1").update(`${source}->${target}::${type}`).digest("hex").slice(0, 12);
  return `rel:${h}`;
}
