const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { run, get, all } = require('../db/database');
const { authenticate, requireProjectAdmin } = require('../middleware/auth');

// GET /api/projects
router.get('/', authenticate, async (req, res) => {
  try {
    let projects;
    if (req.user.role === 'admin') {
      projects = await all(`
        SELECT p.*, u.name as owner_name,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
          (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count
        FROM projects p
        JOIN users u ON u.id = p.owner_id
        ORDER BY p.created_at DESC
      `);
    } else {
      projects = await all(`
        SELECT p.*, u.name as owner_name,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count,
          (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count
        FROM projects p
        JOIN users u ON u.id = p.owner_id
        WHERE p.id IN (SELECT project_id FROM project_members WHERE user_id = ?)
        ORDER BY p.created_at DESC
      `, [req.user.id]);
    }
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects
router.post('/', authenticate, [
  body('name').trim().notEmpty().withMessage('Project name required'),
  body('description').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, description } = req.body;
  try {
    const result = await run(
      'INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)',
      [name, description || null, req.user.id]
    );
    await run(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
      [result.lastID, req.user.id, 'admin']
    );
    const project = await get('SELECT * FROM projects WHERE id = ?', [result.lastID]);
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:projectId
router.get('/:projectId', authenticate, async (req, res) => {
  const { projectId } = req.params;
  try {
    const project = await get(`
      SELECT p.*, u.name as owner_name FROM projects p
      JOIN users u ON u.id = p.owner_id WHERE p.id = ?
    `, [projectId]);

    if (!project) return res.status(404).json({ error: 'Project not found' });

    const membership = await get(
      'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, req.user.id]
    );

    if (req.user.role !== 'admin' && !membership) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const members = await all(`
      SELECT u.id, u.name, u.email, pm.role FROM users u
      JOIN project_members pm ON pm.user_id = u.id
      WHERE pm.project_id = ?
    `, [projectId]);

    res.json({ ...project, members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:projectId
router.put('/:projectId', authenticate, requireProjectAdmin, async (req, res) => {
  const { name, description } = req.body;
  const { projectId } = req.params;
  try {
    await run(
      'UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?',
      [name || null, description || null, projectId]
    );
    res.json(await get('SELECT * FROM projects WHERE id = ?', [projectId]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:projectId
router.delete('/:projectId', authenticate, async (req, res) => {
  const { projectId } = req.params;
  try {
    const project = await get('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (req.user.role !== 'admin' && project.owner_id !== req.user.id) {
      return res.status(403).json({ error: 'Only owner or admin can delete project' });
    }
    await run('DELETE FROM projects WHERE id = ?', [projectId]);
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:projectId/members
router.post('/:projectId/members', authenticate, requireProjectAdmin, [
  body('email').isEmail().normalizeEmail(),
  body('role').optional().isIn(['admin', 'member']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, role = 'member' } = req.body;
  const { projectId } = req.params;
  try {
    const user = await get('SELECT id FROM users WHERE email = ?', [email]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const existing = await get(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, user.id]
    );
    if (existing) return res.status(409).json({ error: 'Already a member' });

    await run(
      'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
      [projectId, user.id, role]
    );
    res.status(201).json({ message: 'Member added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:projectId/members/:userId
router.delete('/:projectId/members/:userId', authenticate, requireProjectAdmin, async (req, res) => {
  const { projectId, userId } = req.params;
  try {
    await run(
      'DELETE FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, userId]
    );
    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;