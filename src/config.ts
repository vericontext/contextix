import { resolve } from "path";
import { homedir } from "os";

export interface ContextixConfig {
  dataDir: string;
  graphFile: string;
  hosted: boolean;
  supabaseUrl?: string;
  supabaseKey?: string;
  domains: string[];
}

export function loadConfig(overrides?: Partial<ContextixConfig>): ContextixConfig {
  const dataDir =
    overrides?.dataDir ??
    process.env.CONTEXTIX_DATA_DIR ??
    resolve(homedir(), ".contextix");

  const hosted =
    overrides?.hosted ??
    (process.env.CONTEXTIX_HOSTED === "1");

  return {
    dataDir,
    graphFile: overrides?.graphFile ?? resolve(dataDir, "graph.json"),
    hosted,
    supabaseUrl: overrides?.supabaseUrl ?? process.env.CONTEXTIX_SUPABASE_URL,
    supabaseKey: overrides?.supabaseKey ?? process.env.CONTEXTIX_SUPABASE_KEY,
    domains: overrides?.domains ?? ["crypto", "macro"],
  };
}
