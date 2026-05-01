import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>;
}
function PriorityBadge({ priority }) {
  return <span className={`badge badge-${priority}`}>{priority}</span>;
}
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function isOverdue(t) {
  if (!t.due_date || t.status === 'done') return false;
  return new Date(t.due_date) < new Date();
}

function TaskModal({ task, members, projectId, onClose, onSaved }) {
  const { user } = useAuth();
  const isEdit = !!task;
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'todo',
    priority: task?.priority || 'medium',
    assignee_id: task?.assignee_id || '',
    due_date: task?.due_date || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, assignee_id: form.assignee_id || null, due_date: form.due_date || null };
      let data;
      if (isEdit) {
        data = (await api.put(`/projects/${projectId}/tasks/${task.id}`, payload)).data;
      } else {
        data = (await api.post(`/projects/${projectId}/tasks`, payload)).data;
      }
      onSaved(data, isEdit);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">{isEdit ? 'Edit Task' : 'Create Task'}</div>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="form-select" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Assignee</label>
              <select className="form-select" value={form.assignee_id} onChange={e => setForm({ ...form, assignee_id: e.target.value })}>
                <option value="">Unassigned</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input type="date" className="form-input" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : isEdit ? 'Update Task' : 'Create Task'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddMemberModal({ projectId, onClose, onAdded }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/projects/${projectId}/members`, { email, role });
      onAdded();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Add Team Member</div>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">User Email</label>
            <input type="email" className="form-input" placeholder="teammate@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Adding...' : 'Add Member'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectDetail() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('tasks');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [filters, setFilters] = useState({ status: '', priority: '' });

  const loadProject = () =>
    api.get(`/projects/${projectId}`).then(r => setProject(r.data));
  const loadTasks = () =>
    api.get(`/projects/${projectId}/tasks`, { params: filters }).then(r => setTasks(r.data));

  useEffect(() => {
    Promise.all([loadProject(), loadTasks()]).finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!loading) loadTasks();
  }, [filters]);

  const membership = project?.members?.find(m => m.id === user.id);
  const isProjectAdmin = user.role === 'admin' || project?.owner_id === user.id || membership?.role === 'admin';

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    await api.delete(`/projects/${projectId}/tasks/${taskId}`);
    setTasks(tasks.filter(t => t.id !== taskId));
  };

  const handleDeleteProject = async () => {
    if (!confirm('Delete this project and all its tasks?')) return;
    await api.delete(`/projects/${projectId}`);
    navigate('/projects');
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Remove this member?')) return;
    await api.delete(`/projects/${projectId}/members/${userId}`);
    loadProject();
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!project) return <div className="page-content"><p>Project not found</p></div>;

  const statusGroups = { todo: [], in_progress: [], done: [] };
  tasks.forEach(t => {
    if (filters.status && t.status !== filters.status) return;
    if (filters.priority && t.priority !== filters.priority) return;
    statusGroups[t.status]?.push(t);
  });
  const filteredTasks = [...statusGroups.todo, ...statusGroups.in_progress, ...statusGroups.done];

  return (
    <>
      <div className="page-header">
        <div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>
            <span onClick={() => navigate('/projects')} style={{ cursor: 'pointer', color: 'var(--accent)' }}>Projects</span> /
          </div>
          <div className="page-title">{project.name}</div>
          {project.description && <div className="page-subtitle">{project.description}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isProjectAdmin && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowTaskModal(true)}>+ Add Task</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddMember(true)}>+ Member</button>
              <button className="btn btn-danger btn-sm" onClick={handleDeleteProject}>Delete Project</button>
            </>
          )}
          {!isProjectAdmin && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowTaskModal(true)}>+ Add Task</button>
          )}
        </div>
      </div>

      <div className="page-content">
        {/* Tabs */}
        <div className="tabs">
          <button className={`tab ${tab === 'tasks' ? 'active' : ''}`} onClick={() => setTab('tasks')}>
            📋 Tasks ({tasks.length})
          </button>
          <button className={`tab ${tab === 'members' ? 'active' : ''}`} onClick={() => setTab('members')}>
            👥 Members ({project.members?.length || 0})
          </button>
        </div>

        {tab === 'tasks' && (
          <>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              <select className="form-select" style={{ width: 'auto' }} value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                <option value="">All Statuses</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
              <select className="form-select" style={{ width: 'auto' }} value={filters.priority} onChange={e => setFilters({ ...filters, priority: e.target.value })}>
                <option value="">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              {(filters.status || filters.priority) && (
                <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ status: '', priority: '' })}>Clear filters</button>
              )}
            </div>

            {filteredTasks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-title">No tasks found</div>
                <div className="empty-state-desc">Create your first task to track progress</div>
                <button className="btn btn-primary" onClick={() => setShowTaskModal(true)}>Add Task</button>
              </div>
            ) : (
              <div className="card">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Assignee</th>
                        <th>Due Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map(t => (
                        <tr key={t.id} className={isOverdue(t) ? 'overdue-row' : ''}>
                          <td>
                            <div style={{ fontWeight: 500 }}>{t.title}</div>
                            {t.description && <div className="text-dim text-xs mt-4">{t.description.slice(0, 60)}{t.description.length > 60 ? '…' : ''}</div>}
                            {isOverdue(t) && <span className="badge badge-overdue" style={{ marginTop: 4 }}>overdue</span>}
                          </td>
                          <td><StatusBadge status={t.status} /></td>
                          <td><PriorityBadge priority={t.priority} /></td>
                          <td className="text-muted">{t.assignee_name || '—'}</td>
                          <td className={isOverdue(t) ? 'text-red' : 'text-dim'}>{formatDate(t.due_date)}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => { setEditTask(t); setShowTaskModal(true); }}>Edit</button>
                              {(isProjectAdmin || t.created_by === user.id) && (
                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTask(t.id)}>Del</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'members' && (
          <div className="card">
            {isProjectAdmin && (
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowAddMember(true)}>+ Add Member</button>
              </div>
            )}
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Email</th>
                  <th>Role</th>
                  {isProjectAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {project.members?.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                          {m.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        {m.name} {m.id === user.id && <span className="tag">you</span>}
                      </div>
                    </td>
                    <td className="text-muted">{m.email}</td>
                    <td><span className={`badge badge-${m.role}`}>{m.role}</span></td>
                    {isProjectAdmin && (
                      <td>
                        {m.id !== project.owner_id && m.id !== user.id && (
                          <button className="btn btn-danger btn-sm" onClick={() => handleRemoveMember(m.id)}>Remove</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showTaskModal && (
        <TaskModal
          task={editTask}
          members={project.members || []}
          projectId={projectId}
          onClose={() => { setShowTaskModal(false); setEditTask(null); }}
          onSaved={(saved, isEdit) => {
            if (isEdit) setTasks(tasks.map(t => t.id === saved.id ? saved : t));
            else setTasks([saved, ...tasks]);
          }}
        />
      )}

      {showAddMember && (
        <AddMemberModal
          projectId={projectId}
          onClose={() => setShowAddMember(false)}
          onAdded={loadProject}
        />
      )}
    </>
  );
}
