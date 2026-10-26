import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), 'paseo-fleet-test-home-'));
process.env.HOME = isolatedHome;
process.env.USERPROFILE = isolatedHome;
