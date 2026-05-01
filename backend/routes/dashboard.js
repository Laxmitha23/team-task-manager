const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

// GET /api/dashboard - summary stats for current user
router.get('/', authenticate, (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  const today = new Date().toISOString().split('T')[0];

  let projectIds;
  if (isAdmin) {
    projectIds = db.prepare('SELECT id FROM projects').all().map(p => p.id);
  } else {
    projectIds = db.prepare('SELECT project_id FROM project_members WHERE user_id = ?').all(userId).map(r => r.project_id);
  }

  const placeholders = projectIds.length ? projectIds.map(() => '?').join(',') : 'NULL';

  const taskStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
      SUM(CASE WHEN due_date < '${today}' AND status != 'done' THEN 1 ELSE 0 END) as overdue
    FROM tasks WHERE project_id IN (${placeholders})
  `).get(...projectIds) || { total: 0, todo: 0, in_progress: 0, done: 0, overdue: 0 };

  const myTasks = db.prepare(`
    SELECT t.*, p.name as project_name, u.name as assignee_name
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.assignee_id = ? AND t.status != 'done'
    ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC
    LIMIT 10
  `).all(userId);

  const overdueTasks = db.prepare(`
    SELECT t.*, p.name as project_name, u.name as assignee_name
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.project_id IN (${placeholders}) AND t.due_date < ? AND t.status != 'done'
    ORDER BY t.due_date ASC
    LIMIT 10
  `).all(...projectIds, today);

  const recentTasks = db.prepare(`
    SELECT t.*, p.name as project_name, u.name as assignee_name
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.project_id IN (${placeholders})
    ORDER BY t.updated_at DESC LIMIT 8
  `).all(...projectIds);

  res.json({
    task_stats: taskStats,
    project_count: projectIds.length,
    my_tasks: myTasks,
    overdue_tasks: overdueTasks,
    recent_tasks: recentTasks,
  });
});

// GET /api/users - list users (for member search)
router.get('/users', authenticate, (req, res) => {
  const users = db.prepare('SELECT id, name, email, role FROM users ORDER BY name').all();
  res.json(users);
});

module.exports = router;
