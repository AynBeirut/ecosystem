/**
 * Seed one open CRM task per team member (admin + sales manager + sales agents).
 *
 * Usage:
 *   node scripts/seedNipcoCrmTestTasks.cjs
 *   node scripts/seedNipcoCrmTestTasks.cjs --dry-run
 */
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const STORE_ID = process.argv.find((a) => a.startsWith('--store='))?.split('=')[1]
  || 'DfIhBAEZ5NR7yNX0HboZvv58Nf82';
const DRY_RUN = process.argv.includes('--dry-run');
const TAG = 'crm-test-task-v1';

async function loadAgents(storeId) {
  const [profileSnap, subSnap, usersSnap] = await Promise.all([
    db.doc(`storeProfiles/${storeId}`).get(),
    db.collection('subAccounts').where('storeId', '==', storeId).get(),
    db.collection('users').where('storeId', '==', storeId).get(),
  ]);

  const userIdBySub = new Map();
  usersSnap.docs.forEach((d) => {
    const subId = d.data().subAccountId;
    if (subId) userIdBySub.set(subId, d.id);
  });

  const profile = profileSnap.data() || {};
  const ownerName = String(profile.storeName || 'Store admin').trim() || 'Store admin';
  const ownerUid = storeId;

  const agents = [
    {
      id: `owner:${storeId}`,
      name: ownerName,
      userId: ownerUid,
      role: 'owner',
    },
  ];

  subSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.status === 'inactive') return;
    const rawRole = String(data.role || 'sales').toLowerCase();
    if (rawRole === 'delivery') return;
    const isManager = rawRole === 'manager';
    agents.push({
      id: `sub:${d.id}`,
      name: String(data.name || (isManager ? 'Sales manager' : 'Sales agent')).trim(),
      userId: userIdBySub.get(d.id) || data.userId || null,
      role: isManager ? 'manager' : 'sales',
    });
  });

  return { agents, ownerUid, ownerName };
}

async function run() {
  const { agents, ownerUid, ownerName } = await loadAgents(STORE_ID);
  const now = new Date().toISOString();
  const due = new Date();
  due.setDate(due.getDate() + 2);
  due.setHours(17, 0, 0, 0);

  const existing = await db.collection('storeTasks')
    .where('storeId', '==', STORE_ID)
    .where('description', '==', TAG)
    .get();

  if (!existing.empty) {
    console.log(`Skip — ${existing.size} test task(s) already exist (${TAG}).`);
    existing.docs.forEach((d) => {
      const t = d.data();
      console.log(`  · ${t.title} → ${t.assignedToName}`);
    });
    return;
  }

  const created = [];
  for (const agent of agents) {
    if (!agent.userId) {
      console.warn(`Skip ${agent.name} — no userId`);
      continue;
    }
    const title = `[Test] Task for ${agent.name}`;
    const payload = {
      storeId: STORE_ID,
      title,
      description: TAG,
      status: 'todo',
      priority: agent.role === 'owner' ? 'high' : 'medium',
      assignedToUserId: agent.userId,
      assignedToName: agent.name,
      assignedToRepId: agent.id,
      createdBy: ownerUid,
      createdByName: ownerName,
      dueAt: due.toISOString(),
      completedAt: null,
      completionFeedback: null,
      feedbackAt: null,
      createdAt: now,
      updatedAt: now,
    };
    if (DRY_RUN) {
      console.log('[dry-run]', title, '→', agent.userId, agent.id);
    } else {
      const ref = await db.collection('storeTasks').add(payload);
      created.push({ id: ref.id, title, assignee: agent.name, role: agent.role });
    }
  }

  if (DRY_RUN) {
    console.log(`Dry run complete — would create ${agents.filter((a) => a.userId).length} tasks.`);
    return;
  }

  console.log(`Created ${created.length} test tasks for store ${STORE_ID}:`);
  created.forEach((c) => console.log(`  · ${c.title} (${c.role}) id=${c.id}`));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
