const path = require("path");
const { version } = require("../../package.json");
const { program } = require("commander");
const { syncWordpressToMarkdown } = require("../lib/index.js");

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
  )
  .option(
    "-r, --renditions <renditions>",
    "Download & resize images. Comma separate renditions: webp@1920,jpeg@800,original"
  )
  .option(
    "--image-dir <dir>",
    "Specify the dest & public path for images, comma separated: /tmp/foo/,/foo/"
  );

program.parse(process.argv);
const options = program.opts();

if (!options.input) {
  program.help();
  process.exit();
}

const [imageDir, imagePublicDir] = (options.imageDir || "").split(",");

syncWordpressToMarkdown({
  baseUrl: options.input,
  destDir: path.resolve(process.cwd(), options.output || "./source"),
  forcePermalinks: options.forcePermalinks,
  renditions: (options.renditions || "")
    .split(",")
    .filter(Boolean)
    .map((rendition) => {
      const [format, width = 0, quality = 80] = rendition.split("@");

      return { format, width: Number(width), quality: Number(quality) };
    }),
  imageDir,
  imagePublicDir,
});
