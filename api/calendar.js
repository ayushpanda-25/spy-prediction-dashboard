// api/calendar.js
// Vercel Serverless Function — fetches economic calendar from Finnhub
// Returns upcoming high/medium-impact US economic events for the next 14 days
// Falls back gracefully — frontend also has static calendar.json

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  // Cache for 4 hours — calendar data doesn't change that often
  res.setHeader('Cache-Control', 's-maxage=14400, stale-while-revalidate=28800');

  const API_KEY = process.env.FINNHUB_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    // Fetch next 14 days of economic events
    const now = new Date();
    const from = now.toISOString().split('T')[0];
    const to = new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0];

    const url = `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${API_KEY}`;
    const response = await fetch(url);
    const text = await response.text();

    if (!response.ok) {
      console.error(`Finnhub calendar error: ${response.status} — ${text}`);
      return res.status(response.status).json({
        error: `Finnhub returned ${response.status}`,
        detail: text.substring(0, 200),
      });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error('Finnhub returned non-JSON:', text.substring(0, 200));
      return res.status(502).json({ error: 'Invalid JSON from Finnhub' });
    }

    const events = data.economicCalendar || [];

    // Filter for US high and medium impact events
    const usEvents = events
      .filter(e => e.country === 'US' && (e.impact === 'high' || e.impact === 'medium'))
      .map(e => ({
        event: e.event,
        date: e.time ? e.time.split(' ')[0] : null,
        time: e.time ? e.time.split(' ').slice(1).join(' ') : null,
        impact: e.impact,
        actual: e.actual ?? null,
        estimate: e.estimate ?? null,
        previous: e.prev ?? null,
        unit: e.unit || '',
      }))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    return res.status(200).json({
      events: usEvents,
      from,
      to,
      totalRaw: events.length,
      fetchedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Calendar API error:', error.message || error);
    return res.status(500).json({ error: 'Failed to fetch economic calendar', detail: String(error.message || error) });
  }
}
