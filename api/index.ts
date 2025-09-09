import { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server/app';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Build the full URL with the API path
    const url = `https://${req.headers.host}${req.url}`;
    
    // Create headers object
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value) {
        headers.set(key, Array.isArray(value) ? value[0] : value);
      }
    });

    // Handle request body
    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      headers.set('content-type', 'application/json');
    }

    // Create the request
    const request = new Request(url, {
      method: req.method,
      headers,
      body,
    });

    // Process with Hono app
    const response = await app.fetch(request);
    
    // Set response status
    res.status(response.status);
    
    // Set response headers
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Handle different content types
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const json = await response.json();
      res.json(json);
    } else if (contentType?.includes('text/')) {
      const text = await response.text();
      res.send(text);
    } else {
      const buffer = await response.arrayBuffer();
      res.end(Buffer.from(buffer));
    }
  } catch (error) {
    console.error('API handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}