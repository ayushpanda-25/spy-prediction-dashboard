// api/news.js
// Vercel Serverless Function — fetches latest market news from Finnhub
// Returns recent high-impact market headlines for the breaking news banner

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  // Cache for 5 minutes — news should be fairly fresh
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  const API_KEY = process.env.FINNHUB_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    // Fetch general market news
    const response = await fetch(
      `https://finnhub.io/api/v1/news?category=general&token=${API_KEY}`
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`Finnhub news error: ${response.status} — ${text}`);
      return res.status(response.status).json({ error: `Finnhub returned ${response.status}` });
    }

    const articles = await response.json();

    // Take the 10 most recent articles, extract key fields
    const headlines = (articles || [])
      .slice(0, 10)
      .map(a => ({
        headline: a.headline,
        source: a.source,
        url: a.url,
        datetime: a.datetime ? new Date(a.datetime * 1000).toISOString() : null,
        category: a.category,
        related: a.related || '',  // related ticker symbols
      }));

    return res.status(200).json({
      headlines,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('News API error:', error.message || error);
    return res.status(500).json({ error: 'Failed to fetch news' });
  }
}
