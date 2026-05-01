const express = require('express');
const router = express.Router();
const { get, all } = require('../db/database');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  const today = new Date().toISOString().split('T')[0];

  try {
    let projectIds;
    if (isAdmin) {
      const projects = await all('SELECT id FROM projects');
      projectIds = projects.map(p => p.id);
    } else {
      const projects = await all(
        'SELECT project_id FROM project_members WHERE user_id = ?',
        [userId]
      );
      projectIds = projects.map(r => r.project_id);
    }

    const placeholders = projectIds.length
      ? projectIds.map(() => '?').join(',')
      : 'NULL';

    const taskStats = projectIds.length ? await get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) as todo,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
        SUM(CASE WHEN due_date < ? AND status != 'done' THEN 1 ELSE 0 END) as overdue
      FROM tasks WHERE project_id IN (${placeholders})
    `, [today, ...projectIds]) : { total: 0, todo: 0, in_progress: 0, done: 0, overdue: 0 };

    const myTasks = await all(`
      SELECT t.*, p.name as project_name, u.name as assignee_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.assignee_id = ? AND t.status != 'done'
      ORDER BY t.due_date ASC, t.created_at DESC
      LIMIT 10
    `, [userId]);

    const overdueTasks = projectIds.length ? await all(`
      SELECT t.*, p.name as project_name, u.name as assignee_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.project_id IN (${placeholders})
      AND t.due_date < ? AND t.status != 'done'
      ORDER BY t.due_date ASC LIMIT 10
    `, [...projectIds, today]) : [];

    const recentTasks = projectIds.length ? await all(`
      SELECT t.*, p.name as project_name, u.name as assignee_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.project_id IN (${placeholders})
      ORDER BY t.updated_at DESC LIMIT 8
    `, projectIds) : [];

    res.json({
      task_stats: taskStats,
      project_count: projectIds.length,
      my_tasks: myTasks,
      overdue_tasks: overdueTasks,
      recent_tasks: recentTasks,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;