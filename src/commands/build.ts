import * as fs from "fs";
import * as path from "path";
import ts from "typescript";
import { spawnSync } from "child_process";
import { cosmofactory_config_schema } from "../utils/validation/cosmofactory-config";

// TODO: skip comments in tsconfig.json

/**
 *
 * @param path
 */
const getNormalizedPath = (path = "") =>
  path.replace(/\/\.$/g, "").replace(/\/$/g, "");

/**
 *
 * @param path
 */
const isFile = (path = "") => {
  const normalizedPath = getNormalizedPath(path);
  return (
    normalizedPath.includes(".") &&
    normalizedPath.charAt(normalizedPath.length - 1) !== "."
  );
};

/**
 * Function that parse a path to create a standard string representing the path
 * actions:
 * - './' for empty path
 * - '/' at the end of the path
 * @param path - path to standardize
 */
const standardizePath = (path: string | undefined) => {
  if (path === undefined) path = "";
  let str = [".", ""].includes(path) ? "./" : path;
  if (str.charAt(str.length - 1) !== "/") str += "/";
  return str;
};

const initWithDotSlash = (path: string) => {
  return /^\.\//g.test(path) ? path : `./${path}`;
};

/**
 * Function that recursively find the path of file with the given extension
 * @param where - the folder to use as root of search
 * @param extensions - an array of extensions without . character
 * @param exclude - an array of extensions to exclude
 */
const getFilesRecursive = (
  where: string,
  extensions = ["ts", "tsx"],
  extensionsExcluded = [".stories.tsx"]
): string[] => {
  // pool to contain files
  const files: string[] = [];

  fs.readdirSync(where).forEach(file => {
    const filePath = path.join(where, file);
    const stat = fs.statSync(filePath);

    const isExtensionMatched = extensions.reduce((acc, ext) => {
      return acc || file.endsWith(ext);
    }, false);

    const isExtensionExcluded = extensionsExcluded.reduce((acc, ext) => {
      return acc || file.endsWith(ext);
    }, false);

    if (stat.isDirectory()) {
      files.push(
        ...getFilesRecursive(filePath, extensions, extensionsExcluded)
      );
    } else if (stat.isFile() && isExtensionMatched && !isExtensionExcluded) {
      files.push(`${filePath}`);
    }
  });

  return files;
};

const pathToWriteOptions = (path = "") => {
  const normalizedPath = getNormalizedPath(path);
  if (isFile(path)) {
    const segmentedPath = normalizedPath.split("/");
    return {
      directory: segmentedPath.slice(0, segmentedPath.length - 1).join("/"),
      fileName: segmentedPath.slice(-1)[0]
    };
  } else {
    return {
      directory: normalizedPath,
      fileName: undefined
    };
  }
};

/**
 *
 */
export const build = async (): Promise<void> => {
  // STEP 0
  // Load the configuration
  if (!fs.existsSync("./.cosmofactory.json")) {
    console.error(
      `config file .cosmofactory.json not found, run 'init' command to create it.`
    );
    process.exit(0);
  }
  // validate the configuration
  const configuration = cosmofactory_config_schema.parse(
    JSON.parse(fs.readFileSync("./.cosmofactory.json", { encoding: "utf8" }))
  );
  // load the tsconfig
  const tsConfig = JSON.parse(
    fs.readFileSync("./tsconfig.json", { encoding: "utf8" })
  );

  // Set the input and output directory pathss
  const srcDir = "./src";
  const distDir = `${initWithDotSlash(tsConfig.compilerOptions.outDir)}`;

  const compilerOptions: ts.CompilerOptions = ts.convertCompilerOptionsFromJson(
    tsConfig.compilerOptions,
    ""
  ).options;

  // Create the output directory if it doesn't exist
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
  }

  // Get the list of files in the input directory
  const files = getFilesRecursive(
    srcDir,
    ["ts", "tsx"],
    configuration.exclude.extensions
  );
  // Get the list of css files
  const cssFiles = getFilesRecursive(srcDir, ["css"], []);
  // Configure the TypeScript program
  const program = ts.createProgram(files, compilerOptions);

  // Run the transpiling
  const emitResult = program.emit();
  // Handle compilation errors
  const allDiagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);
  allDiagnostics.forEach(diagnostic => {
    if (diagnostic.file && diagnostic.start) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
        diagnostic.start
      );
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        "\n"
      );
      console.log(
        `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`
      );
    } else {
      console.log(
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
      );
    }
  });

  if (emitResult.emitSkipped) {
    console.log("The compilation was unsuccessful.");
  } else {
    console.log("The compilation was successful.");
  }

  // Copy files to the output directory
  cssFiles.forEach(cssFile => {
    const path = cssFile.replace(/^(\.\/)?src\//, "");
    configuration.files[cssFile] = `${path}`;
  });
  for (const source of Object.keys(configuration.files)) {
    if (!fs.existsSync(source)) {
      throw new Error(`🧨⚠️💣 Source ${source} does not exist`);
    }

    const destination = `${distDir}/${configuration.files[source]}`;
    const sourceFileName = source.split("/").pop();

    const { fileName: destinationFileName, directory } =
      pathToWriteOptions(destination);

    fs.cpSync(
      source,
      destinationFileName
        ? `${directory}/${destinationFileName}`
        : `${directory}/${sourceFileName}`,
      {
        recursive: true
      }
    );
  }

  // Replace absolute paths to relative paths in the generated JavaScript files
  // TODO: check that
  const jsFiles = getFilesRecursive(
    distDir,
    ["js"],
    configuration.exclude.extensions
  ).filter(file => file.endsWith(".js"));

  jsFiles.forEach(jsFile => {
    const filePath = path.join(jsFile);
    const fileContent = fs.readFileSync(filePath, "utf8");
    const computedBaseUrl = standardizePath(compilerOptions.baseUrl);
    const relative = new Array(
      ...(jsFile.replace(distDir, "").match(/(\/)/g)?.slice(0, -1) ?? [])
    ).reduce(acc => {
      return acc + "../";
    }, "");

    const updatedContent = Object.entries(compilerOptions.paths ?? {}).reduce(
      (content, [key, values]) => {
        // TODO; implement fallback values
        const replacementPath =
          relative +
          (computedBaseUrl + values[0])
            .replace(/(.*)src\/(.*)/, "$2")
            .replace("*", "");
        const pattern = new RegExp(
          `${key === "@/*" ? "@/" : key.replace("$/*", "")}/?(.*?)`,
          "g"
        );
        return content.replace(
          pattern,
          `${
            /^\.\//g.test(replacementPath)
              ? replacementPath
              : `./${replacementPath}`
          }$1`
        );
      },
      fileContent
    );

    fs.writeFileSync(filePath, updatedContent, "utf8");
  });

  // manage tailwindss style
  if (configuration.tailwind) {
    spawnSync("npx", [`tailwindcss`, "-o", `${distDir}/styles.css`, "build"]);
    spawnSync("npx", [
      `tailwindcss`,
      "-o",
      `${distDir}/styles.min.css`,
      "build",
      "--minify"
    ]);
  }
};
