import { z } from "zod";

export const cosmofactory_config_schema = z.object({
  files: z.any(),
  tailwind: z.boolean()
});
