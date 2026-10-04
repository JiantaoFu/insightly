export function parseAppleReviewFeed(data) {
  const entries = data?.feed?.entry;
  return (Array.isArray(entries) ? entries : entries ? [entries] : [])
    .filter(entry => entry['im:rating'] && entry.content)
    .map(entry => ({
      id: entry.id?.label, userName: entry.author?.name?.label,
      userUrl: entry.author?.uri?.label, version: entry['im:version']?.label,
      score: Number(entry['im:rating'].label), title: entry.title?.label,
      text: entry.content.label, updated: entry.updated?.label,
      url: entry.link?.attributes?.href,
    }));
}
