interface CronField {
  values: Set<number>;
  restricted: boolean;
}

export interface CronSchedule {
  matches(date: Date): boolean;
}

const FIELD_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
];

function parseField(text: string, [min, max]: readonly [number, number]): CronField {
  const values = new Set<number>();
  for (const part of text.split(",")) {
    const [rangeText, stepText] = part.split("/");
    const step = stepText === undefined ? 1 : Number(stepText);
    if (!Number.isInteger(step) || step < 1) throw new Error(`invalid step in "${part}"`);
    let from = min;
    let to = max;
    if (rangeText !== "*") {
      const [startText, endText] = rangeText.split("-");
      from = Number(startText);
      to = endText === undefined ? (stepText === undefined ? from : max) : Number(endText);
    }
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < min || to > max || from > to) {
      throw new Error(`"${part}" is outside ${min}-${max}`);
    }
    for (let value = from; value <= to; value += step) values.add(value);
  }
  return { values, restricted: text !== "*" };
}

export function parseCron(expression: string): CronSchedule {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error("needs five fields: minute hour day-of-month month day-of-week");
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields.map((field, index) =>
    parseField(field, FIELD_RANGES[index]),
  );
  if (dayOfWeek.values.has(7)) dayOfWeek.values.add(0);
  return {
    matches(date: Date) {
      const dayOfMonthMatches = dayOfMonth.values.has(date.getDate());
      const dayOfWeekMatches = dayOfWeek.values.has(date.getDay());
      const dayMatches =
        dayOfMonth.restricted && dayOfWeek.restricted
          ? dayOfMonthMatches || dayOfWeekMatches
          : dayOfMonthMatches && dayOfWeekMatches;
      return (
        minute.values.has(date.getMinutes()) &&
        hour.values.has(date.getHours()) &&
        month.values.has(date.getMonth() + 1) &&
        dayMatches
      );
    },
  };
}

export function cronError(expression: string): string | null {
  try {
    parseCron(expression);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}
