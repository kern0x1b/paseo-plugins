import { test } from "node:test";
import assert from "node:assert/strict";
import { cronError, parseCron } from "../shared/cron";

const at = (text: string) => new Date(text);

test("a cron schedule matches steps, ranges and lists", () => {
  const schedule = parseCron("*/15 8-20 * * 1-5");
  assert.equal(schedule.matches(at("2026-11-23T09:30:00")), true);
  assert.equal(schedule.matches(at("2026-11-23T09:31:00")), false);
  assert.equal(schedule.matches(at("2026-11-23T21:00:00")), false);
  assert.equal(schedule.matches(at("2026-11-21T09:30:00")), false, "Saturday");
});

test("Sunday is both 0 and 7, and a restricted day of month or week matches either", () => {
  assert.equal(parseCron("0 9 * * 7").matches(at("2026-11-22T09:00:00")), true);
  assert.equal(parseCron("0 9 1 * 1").matches(at("2026-11-23T09:00:00")), true);
  assert.equal(parseCron("0 9 1 * 1").matches(at("2026-12-01T09:00:00")), true);
});

test("an invalid cron expression names the problem", () => {
  assert.match(cronError("*/2 * * *") ?? "", /five fields/);
  assert.match(cronError("61 * * * *") ?? "", /outside 0-59/);
  assert.match(cronError("*/0 * * * *") ?? "", /invalid step/);
  assert.equal(cronError("*/2 * * * *"), null);
});
