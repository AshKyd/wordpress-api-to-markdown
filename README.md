# 🍱 Wordpress API to markdown

Takes all the posts from a Wordpress wp-api endpoint and writes them to disk as
markdown.

This is an opinionated script for my own use cases, but I welcome PRs to make it
more extensible.

## Usage

```
npx wordpress-api-to-markdown --input example.org --output ./_posts/wordpress
```

This will crawl the wp-json API on `example.org` and write all the posts to
markdown files in `./_posts/wordpress`

Presently this tool _does not download images_, so the original Wordpress
server will still be used to serve images.
