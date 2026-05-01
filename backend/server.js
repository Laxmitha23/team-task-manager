require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// 1. Define your allowed origins
const allowedOrigins = [
  process.env.FRONTEND_URL, 
  'http://localhost:5174',
  'http://127.0.0.1:5174' // Often good to include the IP version for local dev
].filter(Boolean); // This removes the env variable from the list if it's undefined

// 2. Update the CORS middleware
app.use(cors({ 
  origin: allowedOrigins, 
  credentials: true 
}));

app.use(express.json());
app.get('/',(req,res)=>{res.send("This is Backend");})

app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/projects/:projectId/tasks', require('./routes/tasks'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/users', (req, res) => {
  const db = require('./db/database');
  res.json(db.prepare('SELECT id, name, email, role FROM users ORDER BY name').all());
});
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Serve React frontend in production
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 TaskFlow running on port ${PORT}`);
});