const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { authenticate, requireProjectAdmin } = require('../middleware/auth');

// GET /api/projects - list projects user is member of
router.get('/', authenticate, (req, res) => {
  let projects;
  if (req.user.role === 'admin') {
    projects = db.prepare(`
      SELECT p.*, u.name as owner_name,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count
      FROM projects p
      JOIN users u ON u.id = p.owner_id
      ORDER BY p.created_at DESC
    `).all();
  } else {
    projects = db.prepare(`
      SELECT p.*, u.name as owner_name,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
        (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count
      FROM projects p
      JOIN users u ON u.id = p.owner_id
      WHERE p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)
      ORDER BY p.created_at DESC
    `).all(req.user.id);
  }
  res.json(projects);
});

// POST /api/projects - create project
router.post('/', authenticate, [
  body('name').trim().notEmpty().withMessage('Project name required'),
  body('description').optional().trim(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, description } = req.body;
  const result = db.prepare(
    'INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)'
  ).run(name, description || null, req.user.id);

  // Add creator as admin member
  db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(
    result.lastInsertRowid, req.user.id, 'admin'
  );

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(project);
});

// GET /api/projects/:projectId
router.get('/:projectId', authenticate, (req, res) => {
  const { projectId } = req.params;
  const project = db.prepare(`
    SELECT p.*, u.name as owner_name FROM projects p
    JOIN users u ON u.id = p.owner_id WHERE p.id = ?
  `).get(projectId);

  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Check access
  const membership = db.prepare(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(projectId, req.user.id);

  if (req.user.role !== 'admin' && !membership) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const members = db.prepare(`
    SELECT u.id, u.name, u.email, pm.role FROM users u
    JOIN project_members pm ON pm.user_id = u.id
    WHERE pm.project_id = ?
  `).all(projectId);

  res.json({ ...project, members });
});

// PUT /api/projects/:projectId
router.put('/:projectId', authenticate, requireProjectAdmin, [
  body('name').optional().trim().notEmpty(),
  body('description').optional().trim(),
], (req, res) => {
  if (req.projectRole !== 'admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only project admins can edit projects' });
  }
  const { name, description } = req.body;
  const { projectId } = req.params;
  db.prepare('UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?')
    .run(name || null, description || null, projectId);
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId));
});

// DELETE /api/projects/:projectId
router.delete('/:projectId', authenticate, (req, res) => {
  const { projectId } = req.params;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (req.user.role !== 'admin' && project.owner_id !== req.user.id) {
    return res.status(403).json({ error: 'Only owner or admin can delete project' });
  }
  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  res.json({ message: 'Project deleted' });
});

// POST /api/projects/:projectId/members
router.post('/:projectId/members', authenticate, requireProjectAdmin, [
  body('email').isEmail().normalizeEmail(),
  body('role').optional().isIn(['admin', 'member']),
], (req, res) => {
  if (req.projectRole !== 'admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only project admins can add members' });
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, role = 'member' } = req.body;
  const { projectId } = req.params;

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const existing = db.prepare(
    'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(projectId, user.id);
  if (existing) return res.status(409).json({ error: 'Already a member' });

  db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)')
    .run(projectId, user.id, role);
  res.status(201).json({ message: 'Member added' });
});

// DELETE /api/projects/:projectId/members/:userId
router.delete('/:projectId/members/:userId', authenticate, requireProjectAdmin, (req, res) => {
  if (req.projectRole !== 'admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only project admins can remove members' });
  }
  const { projectId, userId } = req.params;
  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(projectId, userId);
  res.json({ message: 'Member removed' });
});

module.exports = router;
