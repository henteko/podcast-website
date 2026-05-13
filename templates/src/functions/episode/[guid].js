const CONFIG = {{config.json}};

const API_URL = CONFIG.api.url;
const SITE_NAME = CONFIG.site.name;

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function onRequest(context) {
  const { params } = context;
  const guid = params.guid;

  // Fetch the original index.html from the static assets
  const assetUrl = new URL("/index.html", context.request.url);
  const assetResponse = await context.env.ASSETS.fetch(assetUrl);
  let html = await assetResponse.text();

  try {
    const apiRes = await fetch(API_URL);
    if (!apiRes.ok) return new Response(html, { headers: { "content-type": "text/html;charset=UTF-8" } });

    const data = await apiRes.json();
    const ep = data.episodes.find((e) => e.guid === guid);

    if (!ep) return new Response(html, { headers: { "content-type": "text/html;charset=UTF-8" } });

    const title = escapeHtml(`${ep.title} | ${SITE_NAME}`);
    const description = escapeHtml(stripHtml(ep.description).slice(0, 200));
    const imageUrl = escapeHtml(data.show.imageUrl);

    // Replace OGP meta tags
    html = html
      .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
      .replace(
        /<meta property="og:title" content="[^"]*">/,
        `<meta property="og:title" content="${title}">`
      )
      .replace(
        /<meta property="og:description" content="[^"]*">/,
        `<meta property="og:description" content="${description}">`
      )
      .replace(
        /<meta property="og:image" content="[^"]*">/,
        `<meta property="og:image" content="${imageUrl}">`
      )
      .replace(
        /<meta property="og:type" content="[^"]*">/,
        `<meta property="og:type" content="article">`
      )
      .replace(
        /<meta name="twitter:title" content="[^"]*">/,
        `<meta name="twitter:title" content="${title}">`
      )
      .replace(
        /<meta name="twitter:description" content="[^"]*">/,
        `<meta name="twitter:description" content="${description}">`
      )
      .replace(
        /<meta name="twitter:image" content="[^"]*">/,
        `<meta name="twitter:image" content="${imageUrl}">`
      )
      .replace(
        /<meta name="description" content="[^"]*">/,
        `<meta name="description" content="${description}">`
      );
  } catch (err) {
    // API fetch failed — return original HTML
  }

  return new Response(html, {
    headers: { "content-type": "text/html;charset=UTF-8" },
  });
}
