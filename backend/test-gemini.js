require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
  try {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.log('No key found in .env');
      return;
    }
    console.log('Testing with key:', key.substring(0, 10) + '...');
    
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Testing a very simple prompt
    const result = await model.generateContent('Hello, say hi.');
    console.log('Success!', result.response.text());
  } catch (err) {
    console.error('Error testing Gemini API:', err.message);
  }
}

testGemini();
