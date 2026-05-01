const jwt = require('jsonwebtoken');
const { get } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_dev_key_change_in_prod';

async function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await get('SELECT id, name, email, role FROM users WHERE id = ?', [payload.id]);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function requireProjectAdmin(req, res, next) {
  const projectId = parseInt(req.params.projectId || req.body.project_id);
  if (!projectId) return res.status(400).json({ error: 'Project ID required' });

  const membership = await get(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
    [projectId, req.user.id]
  );

  const project = await get('SELECT owner_id FROM projects WHERE id = ?', [projectId]);

  if (!project) return res.status(404).json({ error: 'Project not found' });

  if (req.user.role === 'admin' || project.owner_id === req.user.id || (membership && membership.role === 'admin')) {
    req.projectRole = 'admin';
    return next();
  }

  if (membership) {
    req.projectRole = membership.role;
    return next();
  }

  return res.status(403).json({ error: 'Not a member of this project' });
}

module.exports = { authenticate, requireProjectAdmin, JWT_SECRET };