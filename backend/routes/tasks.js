const express = require('express');
const router = express.Router({ mergeParams: true });
const { body, validationResult } = require('express-validator');
const { run, get, all } = require('../db/database');
const { authenticate } = require('../middleware/auth');

async function checkProjectAccess(req, res, next) {
  const projectId = req.params.projectId;
  const membership = await get(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
    [projectId, req.user.id]
  );
  if (req.user.role !== 'admin' && !membership) {
    return res.status(403).json({ error: 'Access denied' });
  }
  req.projectMembership = membership;
  next();
}

// GET /api/projects/:projectId/tasks
router.get('/', authenticate, checkProjectAccess, async (req, res) => {
  const { projectId } = req.params;
  const { status, priority, assignee_id } = req.query;
  try {
    let query = `
      SELECT t.*, u.name as assignee_name, c.name as created_by_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      JOIN users c ON c.id = t.created_by
      WHERE t.project_id = ?
    `;
    const params = [projectId];
    if (status) { query += ' AND t.status = ?'; params.push(status); }
    if (priority) { query += ' AND t.priority = ?'; params.push(priority); }
    if (assignee_id) { query += ' AND t.assignee_id = ?'; params.push(assignee_id); }
    query += ' ORDER BY t.created_at DESC';
    res.json(await all(query, params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:projectId/tasks
router.post('/', authenticate, checkProjectAccess, [
  body('title').trim().notEmpty().withMessage('Title required'),
  body('status').optional().isIn(['todo', 'in_progress', 'done']),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('assignee_id').optional(),
  body('due_date').optional(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { title, description, status = 'todo', priority = 'medium', assignee_id, due_date } = req.body;
  const { projectId } = req.params;
  try {
    const result = await run(`
      INSERT INTO tasks (title, description, status, priority, project_id, assignee_id, created_by, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [title, description || null, status, priority, projectId, assignee_id || null, req.user.id, due_date || null]);

    const task = await get(`
      SELECT t.*, u.name as assignee_name, c.name as created_by_name
      FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
      JOIN users c ON c.id = t.created_by WHERE t.id = ?
    `, [result.lastID]);

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:projectId/tasks/:taskId
router.put('/:taskId', authenticate, checkProjectAccess, async (req, res) => {
  const { taskId, projectId } = req.params;
  try {
    const task = await get(
      'SELECT * FROM tasks WHERE id = ? AND project_id = ?',
      [taskId, projectId]
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const { title, description, status, priority, assignee_id, due_date } = req.body;
    await run(`
      UPDATE tasks SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        priority = COALESCE(?, priority),
        assignee_id = COALESCE(?, assignee_id),
        due_date = COALESCE(?, due_date),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [title || null, description || null, status || null, priority || null,
        assignee_id !== undefined ? (assignee_id || null) : null,
        due_date || null, taskId]);

    const updated = await get(`
      SELECT t.*, u.name as assignee_name, c.name as created_by_name
      FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
      JOIN users c ON c.id = t.created_by WHERE t.id = ?
    `, [taskId]);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:projectId/tasks/:taskId
router.delete('/:taskId', authenticate, checkProjectAccess, async (req, res) => {
  const { taskId, projectId } = req.params;
  try {
    const task = await get(
      'SELECT * FROM tasks WHERE id = ? AND project_id = ?',
      [taskId, projectId]
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });
    await run('DELETE FROM tasks WHERE id = ?', [taskId]);
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;