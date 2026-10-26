import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function useIsolatedHome(prefix = "paseo-fleet-test-home-") {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  return home;
}
