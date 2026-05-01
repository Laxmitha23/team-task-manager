import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>;
}
function PriorityBadge({ priority }) {
  return <span className={`badge badge-${priority}`}>{priority}</span>;
}

function isOverdue(task) {
  if (!task.due_date || task.status === 'done') return false;
  return new Date(task.due_date) < new Date();
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  const s = data?.task_stats || {};

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Good day, {user?.name?.split(' ')[0]} 👋</div>
          <div className="page-subtitle">Here's what's happening across your projects</div>
        </div>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Tasks</div>
            <div className="stat-value">{s.total || 0}</div>
            <div className="stat-desc">across {data?.project_count || 0} projects</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">To Do</div>
            <div className="stat-value" style={{ color: '#94a3b8' }}>{s.todo || 0}</div>
            <div className="stat-desc">not started</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">In Progress</div>
            <div className="stat-value" style={{ color: 'var(--blue)' }}>{s.in_progress || 0}</div>
            <div className="stat-desc">active work</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Done</div>
            <div className="stat-value" style={{ color: 'var(--green)' }}>{s.done || 0}</div>
            <div className="stat-desc">completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Overdue</div>
            <div className="stat-value" style={{ color: 'var(--red)' }}>{s.overdue || 0}</div>
            <div className="stat-desc">past due date</div>
          </div>
        </div>

        <div className="two-col">
          {/* My Tasks */}
          <div>
            <div className="section-title">📌 My Assigned Tasks</div>
            <div className="card">
              {data?.my_tasks?.length ? (
                <div className="task-list">
                  {data.my_tasks.map(t => (
                    <Link to={`/projects/${t.project_id}`} key={t.id} style={{ textDecoration: 'none' }}>
                      <div className={`task-item ${isOverdue(t) ? 'overdue-row' : ''}`}>
                        <div style={{ flex: 1 }}>
                          <div className="task-item-title">{t.title}</div>
                          <div className="task-item-meta">
                            {t.project_name} · due {formatDate(t.due_date)}
                          </div>
                        </div>
                        <StatusBadge status={t.status} />
                        <PriorityBadge priority={t.priority} />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: 24 }}>
                  <div style={{ fontSize: 24 }}>🎉</div>
                  <div className="text-muted text-sm mt-8">No tasks assigned to you</div>
                </div>
              )}
            </div>
          </div>

          {/* Overdue */}
          <div>
            <div className="section-title">🔴 Overdue Tasks</div>
            <div className="card">
              {data?.overdue_tasks?.length ? (
                <div className="task-list">
                  {data.overdue_tasks.map(t => (
                    <Link to={`/projects/${t.project_id}`} key={t.id} style={{ textDecoration: 'none' }}>
                      <div className="task-item">
                        <div style={{ flex: 1 }}>
                          <div className="task-item-title">{t.title}</div>
                          <div className="task-item-meta text-red">
                            {t.project_name} · due {formatDate(t.due_date)} · {t.assignee_name || 'Unassigned'}
                          </div>
                        </div>
                        <StatusBadge status={t.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="empty-state" style={{ padding: 24 }}>
                  <div style={{ fontSize: 24 }}>✅</div>
                  <div className="text-muted text-sm mt-8">No overdue tasks</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div style={{ marginTop: 24 }}>
          <div className="section-title">🕐 Recent Activity</div>
          <div className="card">
            {data?.recent_tasks?.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>Project</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Assignee</th>
                      <th>Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_tasks.map(t => (
                      <tr key={t.id} className={isOverdue(t) ? 'overdue-row' : ''}>
                        <td><strong>{t.title}</strong></td>
                        <td><Link to={`/projects/${t.project_id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{t.project_name}</Link></td>
                        <td><StatusBadge status={t.status} /></td>
                        <td><PriorityBadge priority={t.priority} /></td>
                        <td className="text-muted">{t.assignee_name || '—'}</td>
                        <td className={isOverdue(t) ? 'text-red' : 'text-dim'}>{formatDate(t.due_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state"><div className="text-dim">No recent activity</div></div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
