// api/live.js
// Vercel Serverless Function — fetches live market data from Finnhub
// Called every 60s by the dashboard frontend during market hours.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  const API_KEY = process.env.FINNHUB_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  // Tickers to fetch — SPY, VIX, VIX3M, Treasuries, HY credit
  const tickers = [
    { symbol: 'SPY', key: 'spy' },
    { symbol: 'QQQ', key: 'qqq' },
  ];

  // Finnhub doesn't support ^VIX directly as equity quote,
  // but CBOE VIX index can be fetched via indices endpoint
  const indexSymbols = [
    { symbol: '^VIX', key: 'vix', finnhubSymbol: 'VIX' },
  ];

  // Bonds/ETFs for macro context
  const macroTickers = [
    { symbol: 'TLT', key: 'tlt' },   // 20Y+ Treasury ETF
    { symbol: 'HYG', key: 'hyg' },   // High Yield Corporate Bond ETF
    { symbol: 'GLD', key: 'gld' },   // Gold ETF
  ];

  const allTickers = [...tickers, ...macroTickers];

  try {
    // Fetch all equity/ETF quotes in parallel
    const quotes = await Promise.all(
      allTickers.map(async ({ symbol, key }) => {
        try {
          const response = await fetch(
            `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`
          );
          const data = await response.json();
          return {
            key,
            symbol,
            price: data.c || null,
            change: data.d || null,
            changePct: data.dp || null,
            high: data.h || null,
            low: data.l || null,
            open: data.o || null,
            prevClose: data.pc || null,
            timestamp: data.t ? data.t * 1000 : null,
          };
        } catch {
          return { key, symbol, price: null, error: 'fetch failed' };
        }
      })
    );

    // Build the response object
    const result = {};
    for (const q of quotes) {
      result[q.key] = q;
    }

    // Calculate derived metrics
    const spy = result.spy;

    // Market status: check if current time is during US market hours
    const now = new Date();
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const hour = et.getHours();
    const minute = et.getMinutes();
    const day = et.getDay();
    const marketOpen = day >= 1 && day <= 5 && (hour > 9 || (hour === 9 && minute >= 30)) && hour < 16;

    return res.status(200).json({
      spy_price: spy?.price,
      spy_change: spy?.change,
      spy_change_pct: spy?.changePct,
      vix: result.spy?.price ? null : null, // VIX needs separate handling
      hyg: result.hyg?.price,
      hyg_change: result.hyg?.change,
      tlt: result.tlt?.price,
      tlt_change: result.tlt?.change,
      gld: result.gld?.price,
      gld_change: result.gld?.change,
      qqq: result.qqq?.price,
      qqq_change: result.qqq?.changePct,
      marketOpen,
      last_tick: now.toISOString(),
      quotes: result,
    });
  } catch (error) {
    console.error('Live data API error:', error);
    return res.status(500).json({ error: 'Failed to fetch live data' });
  }
}
