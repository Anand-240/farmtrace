require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/produce', require('./routes/produce'));
app.use('/api/transfer', require('./routes/transfer'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'FarmTrace backend chal raha hai' });
});

mongoose.connect(process.env.MONGO_URI, {
  tls: true,
  tlsAllowInvalidCertificates: true,
  serverSelectionTimeoutMS: 10000,
})
  .then(() => {
    console.log('MongoDB connected!');
    app.listen(process.env.PORT || 4000, '0.0.0.0', () => {
      console.log(`Server port ${process.env.PORT || 4000} pe chal raha hai`);
    });
  })
  .catch(err => console.error('MongoDB error:', err.message));
