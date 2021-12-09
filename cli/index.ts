import * as path from "path";
import { version } from "../package.json";
import { Command } from "commander";
import { syncWordpressToMarkdown } from "../lib";

const program = new Command();

program.version(version);

program
  .option(
    "-i, --input <domain>",
    "base domain for the API (e.g. blog.example.org)"
  )
  .option(
    "-o, --output <dir>",
    "dir to put markdown files. Defaults to ./source"
  )
  .option(
    "-f, --force-permalinks",
    "force writing the permalink field in front matter, for fiddly generators"
  );

program.parse(process.argv);
const options = program.opts();

if (!options.input) {
  program.help();
  process.exit();
}

syncWordpressToMarkdown({
  baseUrl: options.input,
  destDir: path.resolve(process.cwd(), options.output || "./source"),
  forcePermalinks: options.forcePermalinks,
});
