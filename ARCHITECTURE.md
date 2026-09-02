# Making Blog & Projects dynamic — and the honest answer on speed and SEO

## 1. Your question first: is static HTML best for speed and SEO?

**Static HTML is excellent. But it is not better than what I'm recommending — because what I'm recommending *produces static HTML*.**

This is the part that usually gets muddled, so it's worth being precise. Google does not rank hand-written HTML above generated HTML. It has no way to tell the difference, and no reason to care. What it measures is:

- how fast the HTML arrives (TTFB)
- how fast the page becomes usable (LCP, INP, CLS)
- whether the content is in the HTML on arrival, or arrives later via JavaScript

A Next.js site using **static generation with ISR** outputs a pre-rendered HTML file per page, served from a CDN, exactly like the files I've built. Same bytes, same speed, same crawlability. The difference is not what the visitor receives — it's who can update it.

Where "dynamic" genuinely hurts SEO is a different pattern: **client-side rendering**, where the browser downloads an empty shell and fetches content with JavaScript. Google can render that, but slowly and unreliably, and social previews and AI crawlers often can't. That is the thing to avoid — and nothing in this recommendation does it.

### The real trade-off

| | Hand-written HTML (today) | Next.js SSG + ISR (recommended) | WordPress theme (typical) |
|---|---|---|---|
| What the visitor gets | Static HTML | **Static HTML** | HTML built per request by PHP + MySQL |
| TTFB | ~50ms from CDN | **~50ms from CDN** | 300–900ms, worse under load |
| Publishing a blog post | **Developer edits code** | Your team, in an editor | Your team, in an editor |
| Risk of layout drift | Low | Low | High — plugins fight the theme |
| Plugin/security surface | None | None public-facing | Large |

The column that disqualifies pure static HTML is the third row. **You publish 3 articles a month plus project updates — roughly 50 content changes a year.** Every one of those becomes a developer ticket. That is the cost, and it is paid in delay: an article written on Tuesday goes live whenever someone gets to it.

The column that disqualifies a conventional WordPress theme is the first two rows — and you have already seen it. Your staging site loads Slider Revolution's render-blocking payload, renders three duplicate footers, and ships a `maximum-scale` viewport lock. None of that is WordPress's fault exactly, but it is what WordPress themes reliably become.

### The recommendation

**Headless WordPress + Next.js, statically generated with ISR.**

- WordPress stays as the **editor only** — your team already knows it, your agency already runs it. It moves to a subdomain (`cms.bluewingconstruction.com`), and no visitor ever loads it.
- Next.js reads from it at build time and every 60 seconds after, and serves **static HTML from a CDN**.
- You get the publishing workflow of WordPress with the performance profile of the flat files I've built.

Note this is a *smaller* change than it sounds: your content already lives in WordPress. Nothing needs migrating.

---

## 2. What I've built for you

### `data/projects.json` · `data/posts.json`

Your content, extracted from the hardcoded pages into a proper content model — 33 projects and 4 posts. This is useful two ways: it's the schema your WordPress fields should mirror, and it's a working data source if you want the interim option in §4.

Each project record:

```json
{
  "slug": "nb-legacy-tower",
  "title": "NB Legacy Tower",
  "status": "Ongoing",
  "sector": "Residential",
  "sectorSlug": "residential",
  "featured": true,
  "heroImage": "…",
  "gallery": ["…"],
  "specs": { "deliveryModel": "Turnkey / EPC", "location": "Gujarat, India",
             "builtUpArea": null, "duration": null, "client": null, "year": null },
  "excerpt": null,
  "body": null
}
```

The `null`s are the fields you still owe me — they're the ones currently rendering as "On request".

### `nextjs/` — the working dynamic layer

| File | What it does |
|---|---|
| `lib/cms.ts` | The **only** file that talks to WordPress. Types, fetching, field mapping. If you ever change CMS, you change this file and nothing else. |
| `app/blog/page.tsx` | Blog index, static + ISR 60s |
| `app/blog/[slug]/page.tsx` | Article page. `generateStaticParams` pre-renders every post; `BlogPosting` schema for rich results |
| `app/projects/page.tsx` | Project index. All / Ongoing / Completed from one route |
| `app/projects/[slug]/page.tsx` | Project detail with gallery, specs and prev/next |
| `app/sitemap.ts` | **Sitemap builds itself from the CMS** — publish and it's included |
| `app/api/revalidate/route.ts` | Webhook so publishing is instant rather than within 60s |
| `components/PageBanner.tsx` | The shared banner, as a server component |

Two details worth pointing out, because they're the ones that usually get done badly:

**Specs render conditionally.** `specs.filter(([, v]) => Boolean(v))` — an incomplete project shows fewer rows rather than a column of "On request". Empty fields should be invisible, not advertised.

**The sitemap is derived, not maintained.** Nobody has to remember to add a URL. This is the single most common SEO failure on content sites that publish regularly.

---

## 3. What your WordPress needs

Two changes, both a few hours of work:

**1. Register a `project` post type** with `'show_in_rest' => true`, and ACF fields matching the JSON schema above: `status` (select: Ongoing/Completed), `sector_name`, `sector_slug`, `featured` (true/false), `delivery_model`, `location`, `built_up_area`, `duration`, `client`, `year`, `gallery`.

**2. Add the publish webhook:**

```php
add_action('save_post', function ($post_id, $post) {
    if (wp_is_post_revision($post_id) || $post->post_status !== 'publish') return;
    $type = $post->post_type === 'project' ? 'project' : 'post';
    wp_remote_post(sprintf(
        'https://www.bluewingconstruction.com/api/revalidate?secret=%s&type=%s&slug=%s',
        REVALIDATE_SECRET, $type, $post->post_name
    ), ['blocking' => false]);
}, 10, 2);
```

Install Yoast if it isn't already — `lib/cms.ts` reads `yoast_head_json` so your team controls per-post titles and meta descriptions without a developer.

---

## 4. If you want to stay on flat HTML a while longer

A legitimate middle path, and cheaper in the short term: keep the static site, and have the **build script read from `data/*.json`** instead of Python literals. Adding a project becomes editing a JSON file and re-running one command.

Honest assessment: this works, and it is better than editing HTML by hand. But JSON is unforgiving — one missing comma breaks the build, and it is not a job for a marketing person. Treat it as a stopgap for a few months, not a destination.

**What I would not do:** make the current HTML pages fetch JSON in the browser and render client-side. It would be quick, and it would be the one choice that genuinely damages your SEO — your articles would arrive as an empty div for anything that doesn't run JavaScript well.

---

## 5. Suggested sequence

| Step | Work | Outcome |
|---|---|---|
| 1 | Scaffold Next.js, port `bluewing.css` to the token file, move the header/footer into `app/layout.tsx` | Shell running, design identical |
| 2 | Port the 25 static pages (they become simple server components) | Whole site on Next.js |
| 3 | Register the `project` CPT + ACF fields; migrate the 33 projects | Projects editable |
| 4 | Point blog and projects at `lib/cms.ts`; add the webhook | **You publish without a developer** |
| 5 | Deploy to Vercel or Cloudflare Pages; measure Core Web Vitals against staging | Live |

Roughly 3–4 weeks with one developer. Step 4 is the one that changes how you work day to day; everything before it is plumbing.

---

## 6. The short version

- Static HTML is not an SEO advantage over static generation — **they produce the same thing**. The advantage you'd be buying by staying flat is imaginary; the cost is a developer ticket for every one of ~50 content updates a year.
- Client-side rendering *is* an SEO risk. Nothing here uses it.
- Keep WordPress as the editor. Move it behind the scenes. Render with Next.js.
- Your speed will be the same or better than the flat files, because `next/image` and `next/font` do things by default that I'd have to hand-tune here.
