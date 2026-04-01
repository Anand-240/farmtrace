const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
require('dotenv').config();

// Create a dummy image
fs.writeFileSync('dummy.jpg', 'fake image data');

async function testUpload() {
  const form = new FormData();
  form.append('image', fs.createReadStream('dummy.jpg'));

  try {
    const res = await axios.post('http://localhost:4000/api/ai/disease-detect', form, {
      headers: {
        ...form.getHeaders()
      }
    });
    console.log("Upload Success:", res.data);
  } catch (err) {
    if (err.response) {
      console.log("Upload Error Response:", err.response.status, err.response.data);
    } else {
      console.log("Upload Error:", err.message);
    }
  }
}

testUpload();
