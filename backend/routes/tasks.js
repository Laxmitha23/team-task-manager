const express = require('express');
const router = express.Router({ mergeParams: true });
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { authenticate, requireProjectAdmin } = require('../middleware/auth');

function checkProjectAccess(req, res, next) {
  const projectId = req.params.projectId;
  const membership = db.prepare(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(projectId, req.user.id);

  if (req.user.role !== 'admin' && !membership) {
    return res.status(403).json({ error: 'Access denied' });
  }
  req.projectMembership = membership;
  next();
}

// GET /api/projects/:projectId/tasks
router.get('/', authenticate, checkProjectAccess, (req, res) => {
  const { projectId } = req.params;
  const { status, assignee_id, priority } = req.query;

  let query = `
    SELECT t.*, u.name as assignee_name, c.name as created_by_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    JOIN users c ON c.id = t.created_by
    WHERE t.project_id = ?
  `;
  const params = [projectId];

  if (status) { query += ' AND t.status = ?'; params.push(status); }
  if (assignee_id) { query += ' AND t.assignee_id = ?'; params.push(assignee_id); }
  if (priority) { query += ' AND t.priority = ?'; params.push(priority); }
  query += ' ORDER BY t.created_at DESC';

  res.json(db.prepare(query).all(...params));
});

// POST /api/projects/:projectId/tasks
router.post('/', authenticate, checkProjectAccess, [
  body('title').trim().notEmpty().withMessage('Title required'),
  body('description').optional().trim(),
  body('status').optional().isIn(['todo', 'in_progress', 'done']),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('assignee_id').optional().isInt(),
  body('due_date').optional().isDate(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { title, description, status = 'todo', priority = 'medium', assignee_id, due_date } = req.body;
  const { projectId } = req.params;

  // If assignee given, verify they are a member
  if (assignee_id) {
    const isMember = db.prepare(
      'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?'
    ).get(projectId, assignee_id);
    if (!isMember) return res.status(400).json({ error: 'Assignee must be a project member' });
  }

  const result = db.prepare(`
    INSERT INTO tasks (title, description, status, priority, project_id, assignee_id, created_by, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, description || null, status, priority, projectId, assignee_id || null, req.user.id, due_date || null);

  const task = db.prepare(`
    SELECT t.*, u.name as assignee_name, c.name as created_by_name
    FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
    JOIN users c ON c.id = t.created_by WHERE t.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(task);
});

// PUT /api/projects/:projectId/tasks/:taskId
router.put('/:taskId', authenticate, checkProjectAccess, [
  body('title').optional().trim().notEmpty(),
  body('status').optional().isIn(['todo', 'in_progress', 'done']),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('assignee_id').optional(),
  body('due_date').optional(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { taskId, projectId } = req.params;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?').get(taskId, projectId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Members can only update their own tasks (or admins)
  const membership = req.projectMembership;
  if (req.user.role !== 'admin' && (!membership || membership.role !== 'admin') && task.assignee_id !== req.user.id && task.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Cannot edit this task' });
  }

  const { title, description, status, priority, assignee_id, due_date } = req.body;

  db.prepare(`
    UPDATE tasks SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      status = COALESCE(?, status),
      priority = COALESCE(?, priority),
      assignee_id = COALESCE(?, assignee_id),
      due_date = COALESCE(?, due_date),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title || null, description || null, status || null, priority || null,
    assignee_id !== undefined ? (assignee_id || null) : null, due_date || null, taskId);

  const updated = db.prepare(`
    SELECT t.*, u.name as assignee_name, c.name as created_by_name
    FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
    JOIN users c ON c.id = t.created_by WHERE t.id = ?
  `).get(taskId);

  res.json(updated);
});

// DELETE /api/projects/:projectId/tasks/:taskId
router.delete('/:taskId', authenticate, checkProjectAccess, (req, res) => {
  const { taskId, projectId } = req.params;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?').get(taskId, projectId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const membership = req.projectMembership;
  if (req.user.role !== 'admin' && (!membership || membership.role !== 'admin') && task.created_by !== req.user.id) {
    return res.status(403).json({ error: 'Cannot delete this task' });
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  res.json({ message: 'Task deleted' });
});

module.exports = router;
