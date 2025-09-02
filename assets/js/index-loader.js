export async function loadIndex() {
  // Fetch the pre-built search index from the data folder. A cache-busting
  // header is used to ensure the latest version is always pulled in when
  // running locally or via the service worker.
  const res = await fetch('/data/search-index.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load index');
  return res.json();
}
