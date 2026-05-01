const bcrypt = require('bcryptjs');
const { run, get } = require('./db/database');

async function seed() {
  console.log('🌱 Seeding database...');

  await new Promise(resolve => setTimeout(resolve, 500));

  const adminHash = await bcrypt.hash('admin123', 10);
  const memberHash = await bcrypt.hash('member123', 10);

  await run(
    'INSERT OR IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
    ['Admin User', 'admin@demo.com', adminHash, 'admin']
  );
  await run(
    'INSERT OR IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
    ['Jane Member', 'member@demo.com', memberHash, 'member']
  );

  const admin = await get('SELECT id FROM users WHERE email = ?', ['admin@demo.com']);
  const member = await get('SELECT id FROM users WHERE email = ?', ['member@demo.com']);

  await run(
    'INSERT OR IGNORE INTO projects (name, description, owner_id) VALUES (?, ?, ?)',
    ['Website Redesign', 'Revamp company website with modern UI/UX', admin.id]
  );
  await run(
    'INSERT OR IGNORE INTO projects (name, description, owner_id) VALUES (?, ?, ?)',
    ['Mobile App MVP', 'Build the first version of the mobile application', admin.id]
  );

  const proj1 = await get('SELECT id FROM projects WHERE name = ?', ['Website Redesign']);
  const proj2 = await get('SELECT id FROM projects WHERE name = ?', ['Mobile App MVP']);

  await run(
    'INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
    [proj1.id, admin.id, 'admin']
  );
  await run(
    'INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
    [proj1.id, member.id, 'member']
  );
  await run(
    'INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
    [proj2.id, admin.id, 'admin']
  );
  await run(
    'INSERT OR IGNORE INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
    [proj2.id, member.id, 'member']
  );

  const today = new Date();
  const pastDate = new Date(today - 3 * 86400000).toISOString().split('T')[0];
  const futureDate = new Date(today.getTime() + 7 * 86400000).toISOString().split('T')[0];

  const tasks1 = [
    ['Design new homepage mockups', 'Create wireframes', 'done', 'high', member.id, pastDate],
    ['Set up CI/CD pipeline', 'Configure GitHub Actions', 'in_progress', 'high', admin.id, futureDate],
    ['Write API documentation', 'Document all REST endpoints', 'todo', 'medium', member.id, futureDate],
    ['Fix login page bug', 'Users unable to login on Safari', 'todo', 'high', admin.id, pastDate],
    ['Add dark mode support', 'Implement theme switching', 'in_progress', 'low', member.id, futureDate],
  ];

  for (const [title, desc, status, priority, assignee, due] of tasks1) {
    await run(
      'INSERT OR IGNORE INTO tasks (title, description, status, priority, project_id, assignee_id, created_by, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, desc, status, priority, proj1.id, assignee, admin.id, due]
    );
  }

  const tasks2 = [
    ['User authentication flow', 'Implement JWT auth', 'todo', 'high', admin.id, futureDate],
    ['Push notifications setup', 'Integrate Firebase', 'todo', 'medium', member.id, futureDate],
    ['App store submission prep', 'Prepare screenshots', 'todo', 'low', member.id, null],
  ];

  for (const [title, desc, status, priority, assignee, due] of tasks2) {
    await run(
      'INSERT OR IGNORE INTO tasks (title, description, status, priority, project_id, assignee_id, created_by, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, desc, status, priority, proj2.id, assignee, admin.id, due]
    );
  }

  console.log('✅ Seed complete!');
  console.log('  Admin login: admin@demo.com / admin123');
  console.log('  Member login: member@demo.com / member123');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});