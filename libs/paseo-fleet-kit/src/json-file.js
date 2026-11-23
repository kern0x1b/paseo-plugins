import fs from "node:fs";
import path from "node:path";

export function readJsonFile(filePath, valueWhenMissing) {
  if (!fs.existsSync(filePath)) return valueWhenMissing;
  const content = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(content);
  } catch (err) {
    throw new Error(`${filePath} is not valid JSON: ${err.message}`);
  }
}

export function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

export function removeFile(filePath) {
  fs.rmSync(filePath, { force: true });
}
