import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";
import { cronError } from "./cron";

const cron = z.string().refine((expression) => cronError(expression) === null, {
  message: "Not a valid cron expression",
});

export const DEFAULT_MY_EVENTS_CRON = "*/2 * * * *";
export const DEFAULT_ALL_EVENTS_CRON = "*/15 * * * *";

export const featureSettings = defineSettings({
  id: "features",
  scope: "host",
  version: 2,
  schema: z.object({
    explorer: z.boolean().default(true),
    myEvents: z
      .object({ enabled: z.boolean().default(true), cron: cron.default(DEFAULT_MY_EVENTS_CRON) })
      .default({ enabled: true, cron: DEFAULT_MY_EVENTS_CRON }),
    allEvents: z
      .object({ enabled: z.boolean().default(false), cron: cron.default(DEFAULT_ALL_EVENTS_CRON) })
      .default({ enabled: false, cron: DEFAULT_ALL_EVENTS_CRON }),
  }),
  migrate: (values, fromVersion) => {
    const previous = (values ?? {}) as { explorer?: boolean; eventRouter?: boolean };
    if (fromVersion < 2) {
      return {
        explorer: previous.explorer ?? true,
        myEvents: { enabled: previous.eventRouter ?? true, cron: DEFAULT_MY_EVENTS_CRON },
        allEvents: { enabled: false, cron: DEFAULT_ALL_EVENTS_CRON },
      };
    }
    return values;
  },
});

export type FeatureValues = z.infer<typeof featureSettings.schema>;
