const axios = require('axios');

async function testFFLogs() {
  try {
    console.log('🔍 Testing FFLogs scraping...\n');
    
    const response = await axios.post('http://localhost:3000/scrape', {
      url: 'https://www.fflogs.com/zone/statistics/68?dataset=50&class=Any'
    });
    
    console.log('✅ Scraping successful!');
    console.log('📊 Response data:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server is not running. Please start with: npm run dev');
    } else {
      console.error('❌ API test failed:', error.response?.data || error.message);
    }
  }
}

testFFLogs(); 