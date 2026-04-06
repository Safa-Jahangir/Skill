export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY not set in environment variables' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { body = {}; }
    }

    const userMessage = body?.messages?.[0]?.content || '';
    if (!userMessage) {
      return res.status(400).json({ error: 'No prompt provided' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: userMessage }],
        max_tokens: 2000,
        temperature: 0.7
      })
    });

    clearTimeout(timeout);

    const data = await upstream.json();

    if (!upstream.ok) {
      const detail = data?.error?.message || JSON.stringify(data);
      return res.status(upstream.status).json({ error: detail });
    }

    // Convert Groq (OpenAI-compatible) response to Anthropic-compatible format
    const text = data?.choices?.[0]?.message?.content || '';

    return res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out — try again' });
    }
    return res.status(500).json({ error: err.message });
  }
}
