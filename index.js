const fetch = require("isomorphic-fetch");
const mkdirp = require("mkdirp");
const path = require("path");
const fs = require("fs");
const he = require("he");
const yaml = require("yaml");

const taxonomies = {};

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

function wordpressDate(date) {
  return new Date(date + "+1000");
}

async function writeMarkdown({ post, destDir }) {
  const postDate = wordpressDate(post.date_gmt);
  const newDir = [
    postDate.getFullYear(),
    String(postDate.getMonth() + 1).padStart(2, "0"),
    String(postDate.getDate() + 1).padStart(2, "0"),
    post.slug,
  ].join("/");
  const fullDir = path.join(destDir, newDir);
  mkdirp.sync(fullDir);

  const file = `---
${yaml.stringify({
  id: post.id,
  title: he.decode(post.title.rendered),
  date: postDate.toISOString(),
  layout: post.type,
  updated: wordpressDate(post.modified_gmt),
  tags: post.tags,
  catgories: post.categories,
  image:
    post._embedded["wp:featuredmedia"]?.[0]?.media_details?.sizes?.medium
      ?.source_url,
})}
---
${post.content.rendered}  
`;
  fs.writeFileSync(path.join(fullDir, "index.md"), file);
}

async function syncWordpressToMarkdown({
  baseUrl,
  destDir,
  page = 1,
  perPage = 5,
}) {
  const url = `https://${baseUrl}/wp-json/wp/v2/posts?page=${page}&per_page=${perPage}&_embed=true&orderby=modified`;

  const response = await fetch(url);
  if (response.status !== 200) {
    return;
  }
  const json = await response.json();
  await Promise.all(
    json.map(async (post) => {
      const categories = await Promise.all(
        post.categories.map((categoryId) =>
          getTaxonomy(baseUrl, "categories", categoryId)
        )
      );

      const tags = await Promise.all(
        post.tags.map((tagId) => getTaxonomy(baseUrl, "tags", tagId))
      );

      writeMarkdown({ post: { ...post, categories, tags }, destDir });
    })
  );

  syncWordpressToMarkdown({ baseUrl, page: page + 1, perPage, destDir });
}

syncWordpressToMarkdown({
  baseUrl: "photos.ash.ms",
  destDir: "/Users/ash/Web/ash.ms/source/_posts/syncDir",
});
