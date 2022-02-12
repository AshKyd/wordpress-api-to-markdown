const { processHtml } = require("./images");

const fetch = require("isomorphic-fetch");
const mkdirp = require("mkdirp");
const path = require("path");
const fs = require("fs");
const he = require("he");
const yaml = require("yaml");

/**
 * @type any
 */
const taxonomies = {};

/**
 * Get a taxonomy from the API and cache it
 * @param {string} baseUrl
 * @param {string} type
 * @param {number} id
 * @returns string
 */
async function getTaxonomy(baseUrl, type, id) {
  if (!taxonomies[type]) {
    taxonomies[type] = {};
  }
  if (taxonomies[type][id]) {
    return taxonomies[type][id];
  }
  const url = `https://${baseUrl}/wp-json/wp/v2/${type}/${id}`;

  const response = await fetch(url);
  if (response.status !== 200) {
    throw new Error("Missing " + type + ": " + id);
  }
  const json = await response.json();

  taxonomies[type][id] = json.name;
  return json.name;
}

/**
 * Convert a Wordpress date to a JS one
 * @param {string} date
 * @returns Date
 */
function wordpressDate(date) {
  return new Date(date + "+1000");
}

/**
 * Write a post to a markdown file
 * @param {Object} options
 * @param {any} options.post
 * @param {string} options.destDir
 * @param {boolean=} options.forcePermalinks
 * @param {any} options.renditions
 * @param {string} options.imageDir
 * @param {string} options.imagePublicDir
 */
async function writeMarkdown({
  post,
  destDir,
  forcePermalinks,
  renditions,
  imageDir,
  imagePublicDir,
}) {
  const postDate = wordpressDate(post.date_gmt);
  const newDir = [
    postDate.getFullYear(),
    String(postDate.getMonth() + 1).padStart(2, "0"),
    String(postDate.getDate() + 1).padStart(2, "0"),
    post.slug,
  ].join("/");
  const fullDir = path.join(destDir, newDir);
  mkdirp.sync(fullDir);
  mkdirp.sync(imageDir);

  const featuredImage =
    post._embedded["wp:featuredmedia"]?.[0]?.media_details?.sizes?.medium
      ?.source_url;

  const image =
    featuredImage ||
    post.content.rendered.match(/"(https:\/\/[^"]+\.(jpg|png))"/)?.[1];

  const frontMatter = {
    id: post.id,
    title: he.decode(post.title.rendered),
    date: postDate.toISOString(),
    layout: post.type,
    updated: wordpressDate(post.modified_gmt),
    tags: post.tags,
    categories: post.categories,
    image,
    description: he.decode(post.excerpt.rendered.replace(/(<([^>]+)>)/gi, "")),
  };

  // TODO: Backward compatibility flag. Remove it next major bump.
  if (forcePermalinks) {
    frontMatter.permalink = `/${newDir}/`;
  }

  let content = post.content.rendered;
  if (renditions?.length) {
    content = await processHtml({
      html: content,
      renditions,
      imageDir,
      imagePublicDir,
    });
  }

  const file = `---
${yaml.stringify(frontMatter)}
---
${content}  
`;
  fs.writeFileSync(path.join(fullDir, "index.md"), file);
}

/**
 * Export posts from a Wordpress API to makdown files
 * @param {Object} options
 * @param {string} options.baseUrl
 * @param {string} options.destDir
 * @param {number=} options.page
 * @param {number=} options.perPage
 * @param {boolean=} options.forcePermalinks
 * @param {object} options.renditions
 * @param {string} options.imageDir
 * @param {string} options.imagePublicDir
 * @return {Promise<void>}
 */
async function syncWordpressToMarkdown({
  baseUrl,
  destDir,
  page = 1,
  perPage = 5,
  forcePermalinks = false,
  renditions,
  imageDir,
  imagePublicDir,
}) {
  const url = `https://${baseUrl}/wp-json/wp/v2/posts?page=${page}&per_page=${perPage}&_embed=true&orderby=modified`;

  const response = await fetch(url);
  if (response.status !== 200) {
    return;
  }
  const json = await response.json();
  await Promise.all(
    json.map(
      /** @param {any} post */
      async (post) => {
        console.log("> " + post.slug);
        const categories = await Promise.all(
          post.categories.map(
            /** @param {number} categoryId */
            (categoryId) => getTaxonomy(baseUrl, "categories", categoryId)
          )
        );

        const tags = await Promise.all(
          post.tags.map(
            /** @param {number} tagId */
            (tagId) => getTaxonomy(baseUrl, "tags", tagId)
          )
        );

        writeMarkdown({
          post: { ...post, categories, tags },
          destDir,
          forcePermalinks,
          renditions,
          imageDir,
          imagePublicDir,
        });
      }
    )
  );

  syncWordpressToMarkdown({
    baseUrl,
    page: page + 1,
    perPage,
    destDir,
    forcePermalinks,
    renditions,
    imageDir,
    imagePublicDir,
  });
}

module.exports = {
  syncWordpressToMarkdown,
};
