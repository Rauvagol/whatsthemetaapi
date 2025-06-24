const fetch = require('node-fetch');

const API_BASE = process.env.API_URL || 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 Testing Web Scraping API...\n');

  try {
    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${API_BASE}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData.status);
    console.log('');

    // Test root endpoint
    console.log('2. Testing root endpoint...');
    const rootResponse = await fetch(API_BASE);
    const rootData = await rootResponse.json();
    console.log('✅ API info:', rootData.name, 'v' + rootData.version);
    console.log('');

    // Test scraping endpoint
    console.log('3. Testing scraping endpoint...');
    const testUrl = 'https://example.com';
    const scrapeResponse = await fetch(`${API_BASE}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: testUrl })
    });
    const scrapeData = await scrapeResponse.json();
    
    if (scrapeData.success) {
      console.log('✅ Scraping successful!');
      console.log('🏞️ Zone Name:', scrapeData.data.zoneName || 'Not found');
      console.log('👹 Boss Name:', scrapeData.data.bossName || 'Not found');
      console.log('📊 Table Rows:', scrapeData.data.tableRows.length);
      if (scrapeData.data.tableRows.length > 0) {
        console.log('📋 Sample row:', scrapeData.data.tableRows[0]);
      }
    } else {
      console.log('❌ Scraping failed:', scrapeData.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the API is running on', API_BASE);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testAPI();
}

module.exports = { testAPI }; 