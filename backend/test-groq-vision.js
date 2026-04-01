require('dotenv').config();
const Groq = require('groq-sdk');

async function testGroq() {
  try {
    const key = process.env.GROQ_API_KEY;
    console.log('Testing Groq with key:', key.substring(0, 5) + '...');
    const groq = new Groq({ apiKey: key });

    const completion = await groq.chat.completions.create({
      model: "llama-3.2-11b-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What's in this image?" },
            {
              type: "image_url",
              image_url: {
                url: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg"
              }
            }
          ]
        }
      ],
      temperature: 1,
      max_tokens: 1024,
      top_p: 1,
      stream: false,
    });
    
    console.log('Success:', completion.choices[0].message.content);
  } catch (err) {
    console.error('Error with Groq:', err.message);
  }
}

testGroq();
