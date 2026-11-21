import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const featureSettings = defineSettings({
  id: "features",
  scope: "host",
  version: 1,
  schema: z.object({
    explorer: z.boolean().default(true),
    eventRouter: z.boolean().default(true),
  }),
});
