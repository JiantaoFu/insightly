const SITE_ORIGIN = 'https://insightly.top';

interface MetadataOptions {
  /** Site-relative path, e.g. '/for-teams' or '/blog/find-app-ideas' */
  canonicalPath?: string;
  /** Absolute image URL for social share cards */
  image?: string;
  keywords?: string;
}

function setMeta(selector: string, content: string) {
  document.querySelector(selector)?.setAttribute('content', content);
}

function setCanonicalLink(href: string) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

export function updateMetadata(title: string, description: string, options: MetadataOptions = {}) {
  // Update standard meta tags
  document.title = title;
  setMeta('meta[name="title"]', title);
  setMeta('meta[name="description"]', description);
  if (options.keywords) {
    setMeta('meta[name="keywords"]', options.keywords);
  }

  // Update OpenGraph meta tags
  setMeta('meta[property="og:title"]', title);
  setMeta('meta[property="og:description"]', description);

  // Update Twitter meta tags
  setMeta('meta[name="twitter:title"]', title);
  setMeta('meta[name="twitter:description"]', description);

  if (options.image) {
    setMeta('meta[property="og:image"]', options.image);
    setMeta('meta[property="og:image:alt"]', title);
    setMeta('meta[name="twitter:image"]', options.image);
    setMeta('meta[name="twitter:image:alt"]', title);
  }

  if (options.canonicalPath) {
    const canonicalUrl = `${SITE_ORIGIN}${options.canonicalPath}`;
    setCanonicalLink(canonicalUrl);
    setMeta('meta[property="og:url"]', canonicalUrl);
    setMeta('meta[name="twitter:url"]', canonicalUrl);
  }
}

const DYNAMIC_JSONLD_ID = 'dynamic-jsonld';

/** Replaces the page's structured data with a page-specific schema (e.g. Article). */
export function setStructuredData(data: Record<string, unknown>) {
  let script = document.getElementById(DYNAMIC_JSONLD_ID) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = DYNAMIC_JSONLD_ID;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

/** Removes the page-specific schema, falling back to the site-wide one in index.html. */
export function clearStructuredData() {
  document.getElementById(DYNAMIC_JSONLD_ID)?.remove();
}
