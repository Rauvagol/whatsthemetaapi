const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { chromium } = require('playwright');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Main scraping endpoint
app.post('/scrape', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ 
      error: 'URL is required',
      example: {
        url: 'https://example.com'
      }
    });
  }

  // Validate URL format
  try {
    new URL(url);
  } catch (error) {
    return res.status(400).json({ 
      error: 'Invalid URL format',
      example: {
        url: 'https://example.com'
      }
    });
  }

  let browser;
  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    
    // Set longer timeout for JavaScript-heavy pages
    page.setDefaultTimeout(60000);
    
    console.log('🌐 Navigating to:', url);
    
    // Navigate to the URL and wait for DOM content to be loaded
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    console.log('⏳ Waiting for page to load...');
    
    // Wait for the page to fully load and for any dynamic content
    await page.waitForTimeout(10000);
    
    // Try to wait for any content to appear
    try {
      // Wait for any table or content to appear
      await page.waitForSelector('table, tr, .zone-name, #filter-boss-text', { timeout: 30000 });
      console.log('✅ Page content found');
    } catch (error) {
      console.log('⚠️ Expected elements not found, continuing anyway...');
    }

    // Extract data from the page using the specific selectors
    const scrapedData = await page.evaluate(() => {
      const data = {
        zoneName: '',
        bossName: '',
        tableRows: [],
        timestamp: new Date().toISOString()
      };

      // Extract Zone Name
      try {
        const zoneElement = document.querySelector('a.zone-name');
        if (zoneElement) {
          data.zoneName = zoneElement.textContent.trim();
          console.log('Found zone name:', data.zoneName);
        }
      } catch (error) {
        console.error('Error extracting zone name:', error);
      }

      // Extract Boss Name
      try {
        const bossElement = document.querySelector('#filter-boss-text');
        if (bossElement) {
          data.bossName = bossElement.textContent.trim();
          console.log('Found boss name:', data.bossName);
        }
      } catch (error) {
        console.error('Error extracting boss name:', error);
      }

      // Extract Table Rows
      try {
        const tableRows = document.querySelectorAll('tr.odd, tr.even');
        console.log('Found table rows:', tableRows.length);
        
        tableRows.forEach((row, index) => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 4) {
            const rowData = {
              jobName: cells[0].textContent.trim(),
              score: cells[1].textContent.trim(),
              count: cells[3].textContent.trim()
            };
            data.tableRows.push(rowData);
            console.log(`Row ${index + 1}:`, rowData);
          }
        });
      } catch (error) {
        console.error('Error extracting table rows:', error);
      }

      return data;
    });

    await browser.close();
    
    console.log('📊 Scraping completed successfully');
    
    res.json({
      success: true,
      data: scrapedData
    });

  } catch (error) {
    console.error('Scraping error:', error);
    
    if (browser) {
      await browser.close();
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to scrape the website',
      message: error.message
    });
  }
});

// GET endpoint for convenience
app.get('/scrape', (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ 
      error: 'URL parameter is required',
      example: '/scrape?url=https://example.com'
    });
  }

  // Redirect to POST with the URL in body
  res.json({
    message: 'Please use POST /scrape with URL in request body',
    example: {
      method: 'POST',
      url: '/scrape',
      body: { url: 'https://example.com' }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Something went wrong!'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'POST /scrape',
      'GET /scrape'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Scrape endpoint: http://localhost:${PORT}/scrape`);
}); 