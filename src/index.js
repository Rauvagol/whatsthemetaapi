const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Main scraping endpoint
app.post('/scrape', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ 
      error: 'URL is required in request body',
      example: { "url": "https://example.com" }
    });
  }

  // Validate URL
  try {
    new URL(url);
  } catch (error) {
    return res.status(400).json({ 
      error: 'Invalid URL format',
      provided: url
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
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();
    
    // Set timeout for navigation
    page.setDefaultTimeout(30000);
    
    // Navigate to the URL
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Wait for specific elements to be visible to ensure page is loaded
    try {
      // Wait for table rows to be visible (they might load dynamically)
      await page.waitForSelector('tbody tr.odd, tbody tr.even', { 
        timeout: 15000,
        state: 'visible' 
      });
    } catch (error) {
      console.log('Table rows not found, continuing with page evaluation');
    }

    // Extract specific data from the page
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
        }
      } catch (error) {
        console.log('Zone name not found');
      }

      // Extract Boss Name
      try {
        const bossElement = document.querySelector('#filter-boss-text');
        if (bossElement) {
          data.bossName = bossElement.textContent.trim();
        }
      } catch (error) {
        console.log('Boss name not found');
      }

      // Extract Table Rows
      try {
        const rows = document.querySelectorAll('tr.odd, tr.even');
        data.tableRows = Array.from(rows).map(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 4) {
            return {
              jobName: cells[0] ? cells[0].textContent.trim() : '',
              score: cells[1] ? cells[1].textContent.trim() : '',
              count: cells[3] ? cells[3].textContent.trim() : ''
            };
          }
          return null;
        }).filter(row => row !== null);
      } catch (error) {
        console.log('Table rows not found');
      }

      return data;
    });

    await browser.close();
    
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

// Root endpoint with usage instructions
app.get('/', (req, res) => {
  res.json({
    name: 'Web Scraping API',
    version: '1.0.0',
    description: 'A web scraping API built with Playwright',
    endpoints: {
      health: {
        method: 'GET',
        path: '/health',
        description: 'Health check endpoint'
      },
      scrape: {
        method: 'POST',
        path: '/scrape',
        description: 'Scrape a website and return specific data as JSON',
        body: {
          url: {
            type: 'string',
            required: true,
            description: 'The URL to scrape'
          }
        },
        example: {
          url: 'https://example.com'
        },
        response: {
          zoneName: 'Zone name from a.zone-name',
          bossName: 'Boss name from #filter-boss-text',
          tableRows: [
            {
              jobName: 'Job name from td:nth-child(1)',
              score: 'Score from td:nth-child(2)',
              count: 'Count from td:nth-child(4)'
            }
          ]
        }
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Web Scraping API server running on port ${PORT}`);
  console.log(`📖 API Documentation: http://localhost:${PORT}`);
  console.log(`🔍 Example usage: POST http://localhost:${PORT}/scrape with body: {"url": "https://example.com"}`);
}); 