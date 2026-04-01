require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
async function test() {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent("Hello!");
    console.log("Success with gemini-1.5-flash:", result.response.text());
  } catch(e) { console.log("Err 1:", e.message) }
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
    const result = await model.generateContent("Hello!");
    console.log("Success with gemini-1.5-flash-latest:", result.response.text());
  } catch(e) { console.log("Err 2:", e.message) }
}
test();
