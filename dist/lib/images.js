const fetch = require("isomorphic-fetch");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { Buffer } = require("buffer");
/**
 * Resize an image
 * @param {object} options
 * @param {any} options.imageBuffer
 * @param {string} options.outputFile
 * @param {number} options.width
 * @param {string} options.format
 * @param {number} options.quality
 * @returns
 */
async function processImage({
  imageBuffer,
  outputFile,
  width,
  format,
  quality = 80,
}) {
  let transformer = sharp(imageBuffer).resize(width);

  if (format === "webp") {
    transformer = transformer.webp({ quality });
  }
  if (format === "jpg") {
    transformer = transformer.jpeg({ quality, mozjpeg: true });
  }

  return transformer.toFile(outputFile);
}

/**
 * Resize an image to the given renditions
 * @param {string} image
 * @param {Array<{ width: number, format: string, quality: number, outputDir: string, outputFile: string }>} renditions
 */
async function processImages(image, renditions) {
  const response = await fetch(image);
  const imageBuffer = await response.buffer();

  return Promise.all(
    renditions.map(({ width, format, quality, outputDir, outputFile }) => {
      const fullOutputFile = path.join(outputDir, outputFile);
      if (format === "original") {
        fs.writeFileSync(fullOutputFile, imageBuffer);
        return Promise.resolve();
      }

      return processImage({
        imageBuffer,
        outputFile: fullOutputFile,
        width,
        format,
        quality,
      });
    })
  );
}

/**
 *
 * @param {object} options
 * @param {string} options.html
 * @param {Array<{ width: number, format: string, quality: number }>} options.renditions
 * @param {string} options.imageDir
 * @param {string} options.imagePublicDir
 */
async function processHtml({ html, renditions, imageDir, imagePublicDir }) {
  const images = html.match(/<img[^>]+>/g) || [];
  const imageMaps = images
    .map((imageHtml) => {
      return { imageHtml, src: imageHtml.match(/src="([^"]+)"/)?.[1] || "" };
    })
    .filter(({ src }) => src.match(/https?:\/\//) && !src.includes("?"))
    .map(({ imageHtml, src }) => {
      const filename = src.match(/([^\/]+)\.\w+$/)?.[1];

      let theseRenditions = renditions;

      if (!src.match(/\.jpe?g$/i)) {
        theseRenditions = [
          { format: "original", width: 0, quality: 0, outputDir: imageDir },
        ];
      }

      theseRenditions = theseRenditions.map((rendition) => ({
        ...rendition,
        outputDir: imageDir,
        outputFile:
          rendition.format === "original"
            ? String(src.split("/").pop())
            : `${filename}@${rendition.width}.${rendition.format}`,
      }));

      const imagePromise = processImages(src, theseRenditions).catch(
        (e) => false
      );

      if (!imagePromise) {
        return false;
      }

      return {
        src,
        imageHtml,
        imagePromise,
        theseRenditions,
      };
    })
    .filter(Boolean);

  let newHtml = html;
  imageMaps.forEach(({ imageHtml, theseRenditions }) => {
    const srcsetTags = theseRenditions.map(
      (rendition) =>
        `<source srcset="${imagePublicDir}${rendition.outputFile} ${
          rendition.width || 9999
        }w" ${
          rendition.format === "original"
            ? ""
            : `type="image/${rendition.format}"`
        }>`
    );

    const imgRendition = theseRenditions[theseRenditions.length - 1];
    const newImg = imageHtml.replace(
      /src="[^"]+"/,
      `src="${imagePublicDir}${imgRendition?.outputFile}"`
    );
    const pictureTag = `<picture>
${srcsetTags.join("\n")}
${newImg}
</picture>`;
    newHtml = newHtml.replace(imageHtml, pictureTag);
  });

  await Promise.all(imageMaps.map(({ imagePromise }) => imagePromise));

  return newHtml;
}

module.exports = {
  processHtml,
};
