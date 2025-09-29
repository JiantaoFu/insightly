export function updateMetadata(title: string, description: string) {
  // Update standard meta tags
  document.title = title;
  document.querySelector('meta[name="title"]')?.setAttribute('content', title);
  document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  
  // Update OpenGraph meta tags
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
  
  // Update Twitter meta tags
  document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title);
  document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', description);
}