const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file' });
  }
  res.json({ success: true });
});

// Basic error handler to mimic Express default
app.use((err, req, res, next) => {
  console.error("Express Caught Error:", err.message);
  res.status(500).json({ error: err.message });
});

const server = app.listen(5005, async () => {
  try {
    fs.writeFileSync('dummy.jpg', 'fake image data');
    const form = new FormData();
    form.append('image', fs.createReadStream('dummy.jpg'));

    // Attempt 1: Without explicit headers override (SHOULD WORK)
    console.log("Attempt 1: No override");
    const res1 = await axios.post('http://localhost:5005/upload', form);
    console.log("Res 1:", res1.data);
  } catch (e) {
    console.log("Err 1:", e.response ? e.response.status : e.message);
  }

  try {
    const form2 = new FormData();
    form2.append('image', fs.createReadStream('dummy.jpg'));
    
    // Attempt 2: Override headers with plain multipart/form-data (MIMICS FRONTEND)
    console.log("Attempt 2: Override headers");
    const res2 = await axios.post('http://localhost:5005/upload', form2, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    console.log("Res 2:", res2.data);
  } catch (e) {
    console.log("Err 2:", e.response ? e.response.status : e.message);
  }

  server.close();
});
