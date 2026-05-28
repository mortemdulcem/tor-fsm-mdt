// Merge v1 and v2 results + 4-cell analysis into unified shadow_results.json.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const v1 = JSON.parse(
  await fs.readFile(path.resolve(__dirname, "shadow_results_v1.json"), "utf8"),
);
const v2 = JSON.parse(
  await fs.readFile(path.resolve(__dirname, "shadow_results_v2.json"), "utf8"),
);
const fourCell = JSON.parse(
  await fs.readFile(
    path.resolve(__dirname, "shadow_results_4cell.json"),
    "utf8",
  ),
);

const merged = {
  v1: {
    metadata: v1.metadata,
    perScenario: v1.perScenario,
    summary: v1.summary,
  },
  v2: {
    metadata: v2.metadata,
    perCell: v2.perCell,
  },
  fourCellComparison: fourCell,
  mergedAt: new Date().toISOString(),
};

await fs.writeFile(
  path.resolve(__dirname, "shadow_results.json"),
  JSON.stringify(merged, null, 2),
);
console.log("Merged results written to shadow_results.json");
