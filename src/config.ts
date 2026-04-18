import { resolve } from "path";
import { homedir } from "os";

export interface ContextixConfig {
  dataDir: string;
  graphFile: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  domains: string[];
}

export function loadConfig(overrides?: Partial<ContextixConfig>): ContextixConfig {
  const dataDir =
    overrides?.dataDir ??
    process.env.CONTEXTIX_DATA_DIR ??
    resolve(homedir(), ".contextix");

  return {
    dataDir,
    graphFile: overrides?.graphFile ?? resolve(dataDir, "graph.json"),
    supabaseUrl: overrides?.supabaseUrl ?? process.env.CONTEXTIX_SUPABASE_URL,
    supabaseAnonKey:
      overrides?.supabaseAnonKey ?? process.env.CONTEXTIX_SUPABASE_ANON_KEY,
    domains: overrides?.domains ?? ["crypto", "macro"],
  };
}
