import { RegexExtractor } from "./regex.js";
import type { Extractor } from "./regex.js";

export type { Extractor, ExtractorInput, ExtractorOutput } from "./regex.js";
export { RegexExtractor } from "./regex.js";
export { AgenticExtractor, type TokenUsage } from "./agentic.js";

export type ExtractorMode = "auto" | "agentic" | "regex";

export async function getExtractor(mode: ExtractorMode = "auto"): Promise<Extractor> {
  const resolved = resolveMode(mode);
  if (resolved === "agentic") {
    const { AgenticExtractor } = await import("./agentic.js");
    return new AgenticExtractor();
  }
  return new RegexExtractor();
}

function resolveMode(mode: ExtractorMode): "agentic" | "regex" {
  if (mode === "agentic") return "agentic";
  if (mode === "regex") return "regex";
  const envOverride = process.env.CONTEXTIX_EXTRACTOR;
  if (envOverride === "regex" || envOverride === "agentic") return envOverride;
  return process.env.ANTHROPIC_API_KEY ? "agentic" : "regex";
}
