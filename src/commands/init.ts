import * as fs from "fs";
import { ask } from "@/utils/functions";

export const init = async (): Promise<void> => {
  let does_override = true;

  if (fs.existsSync("./.cosmofactory.json")) {
    does_override = (
      await ask({
        type: "toggle",
        name: "does_override",
        message:
          ".cosmofactory configuration file already exists, do you want to override it ?",
        active: "yes",
        inactive: "no"
      })
    ).does_override;
  }

  if (does_override) {
    // create config file
    fs.writeFileSync(
      "./.cosmofactory.json",
      JSON.stringify(
        {
          files: {
            "package.json": "./",
            "plugin-tailwind.ts": "./",
            "tailwind.config.ts": "./"
          },
          tailwind: true
        },
        null,
        2
      )
    );
    console.log(".cosmofactory.json file was successfully created");
  }
};
