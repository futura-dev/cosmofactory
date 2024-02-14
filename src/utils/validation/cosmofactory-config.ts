import { z } from "zod";

export const cosmofactory_config_schema = z.object({
  files: z.record(z.string(), z.string()),
  tailwind: z.boolean(),
  exclude: z.object({
    extensions: z.array(z.string())
  })
});
