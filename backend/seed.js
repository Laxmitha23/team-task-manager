// Run: node backend/seed.js
// Creates demo users and sample data

const db = require('./db/database');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('🌱 Seeding database...');

  // Create demo users
  const adminHash = await bcrypt.hash('admin123', 10);
  const memberHash = await bcrypt.hash('member123', 10);

  const adminResult = db.prepare(
    'INSERT OR IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
  ).run('Admin User', 'admin@demo.com', adminHash, 'admin');

  const memberResult = db.prepare(
    'INSERT OR IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
  ).run('Jane Member', 'member@demo.com', memberHash, 'member');

  const adminId = adminResult.lastInsertRowid || db.prepare('SELECT id FROM users WHERE email = ?').get('admin@demo.com').id;
  const memberId = memberResult.lastInsertRowid || db.prepare('SELECT id FROM users WHERE email = ?').get('member@demo.com').id;

  // Create projects
  const proj1 = db.prepare(
    'INSERT OR IGNORE INTO projects (name, description, owner_id) VALUES (?, ?, ?)'
  ).run('Website Redesign', 'Revamp company website with modern UI/UX', adminId);

  const proj2 = db.prepare(
    'INSERT OR IGNORE INTO projects (name, description, owner_id) VALUES (?, ?, ?)'
  ).run('Mobile App MVP', 'Build the first version of the mobile application', adminId);

  const proj1Id = proj1.lastInsertRowid;
  const proj2Id = proj2.lastInsertRowid;

  if (proj1Id) {
    // Add members
    db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(proj1Id, adminId, 'admin');
    db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(proj1Id, memberId, 'member');

    const today = new Date();
    const pastDate = new Date(today - 3 * 86400000).toISOString().split('T')[0];
    const futureDate = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0];

    // Tasks
    const tasks = [
      ['Design new homepage mockups', 'Create wireframes and high-fidelity mockups', 'done', 'high', memberId, pastDate],
      ['Set up CI/CD pipeline', 'Configure GitHub Actions for auto-deploy', 'in_progress', 'high', adminId, futureDate],
      ['Write API documentation', 'Document all REST endpoints with examples', 'todo', 'medium', memberId, futureDate],
      ['Fix login page bug', 'Users unable to login on Safari', 'todo', 'high', adminId, pastDate],
      ['Add dark mode support', 'Implement theme switching', 'in_progress', 'low', memberId, futureDate],
    ];

    tasks.forEach(([title, desc, status, priority, assignee, due]) => {
      db.prepare(
        'INSERT OR IGNORE INTO tasks (title, description, status, priority, project_id, assignee_id, created_by, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(title, desc, status, priority, proj1Id, assignee, adminId, due);
    });
  }

  if (proj2Id) {
    db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(proj2Id, adminId, 'admin');
    db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(proj2Id, memberId, 'member');

    const futureDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    const tasks2 = [
      ['User authentication flow', 'Implement JWT auth in React Native', 'todo', 'high', adminId, futureDate],
      ['Push notifications setup', 'Integrate Firebase Cloud Messaging', 'todo', 'medium', memberId, futureDate],
      ['App store submission prep', 'Prepare screenshots and metadata', 'todo', 'low', memberId, null],
    ];

    tasks2.forEach(([title, desc, status, priority, assignee, due]) => {
      db.prepare(
        'INSERT OR IGNORE INTO tasks (title, description, status, priority, project_id, assignee_id, created_by, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(title, desc, status, priority, proj2Id, assignee, adminId, due);
    });
  }

  console.log('✅ Seed complete!');
  console.log('  Admin login: admin@demo.com / admin123');
  console.log('  Member login: member@demo.com / member123');
}

seed().catch(console.error);
