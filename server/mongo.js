// ============================================
// MongoDB persistence (used when MONGODB_URI is set; works with the free Atlas tier).
//
// The app keeps its working data in memory (the `db` object in db.js) and every route
// reads it directly. This module mirrors that state into real MongoDB collections:
//   users, courses, videos, enrollments, logs, alerts, audit, payments, sessions,
//   streamSessions   -> one document per item (_id = the item's id)
//   progress, settings, activity -> one document per user
//   meta             -> one document (JWT secret, flags)
// Writes are batched shortly after a change and only changed documents are sent. A single
// server instance is assumed (Render's free plan is one instance).
// Encrypted videos and thumbnails live in GridFS buckets "videos" and "thumbs".
// ============================================

// The driver is loaded on connect(), so a JSON-file install never pays for it
let MongoClient;
let GridFSBucket;
let client = null;
let mdb = null;

// collection -> true when new items are added at the FRONT of the array (unshift)
const ARRAYS = {
  users: false, courses: true, videos: true, enrollments: false, logs: true, alerts: true,
  audit: true, payments: true, chat: true, sessions: false, streamSessions: false,
};
const MAPS = ['progress', 'settings', 'activity'];

export const connect = async (uri, dbName) => {
  ({ MongoClient, GridFSBucket } = await import('mongodb'));
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000, maxPoolSize: 10 });
  try {
    await client.connect();
    mdb = client.db(dbName || undefined);
    await mdb.command({ ping: 1 });
  } catch (err) {
    throw new Error(`Could not connect to MongoDB (${err.message}). Check MONGODB_URI and, on Atlas, that Network Access allows this server.`);
  }
  await enforceUserRules();
  return mdb;
};

// Database-level guard for accounts: a user document must have a valid name, a lowercase
// email and a password hash, and no two accounts may share an email. Best effort: a managed
// cluster user without permission to change this only gets a warning.
const enforceUserRules = async () => {
  try {
    const existing = await mdb.listCollections({ name: 'users' }).toArray();
    const validator = {
      $jsonSchema: {
        bsonType: 'object',
        required: ['name', 'email', 'passwordHash', 'role'],
        properties: {
          name: { bsonType: 'string', minLength: 2, maxLength: 60 },
          email: { bsonType: 'string', maxLength: 254, pattern: String.raw`^[^\s@]+@[^\s@]+\.[^\s@]+$` },
          passwordHash: { bsonType: 'string', minLength: 20 },
          role: { enum: ['learner', 'creator', 'admin'] },
        },
      },
    };
    if (existing.length) await mdb.command({ collMod: 'users', validator, validationLevel: 'moderate', validationAction: 'error' });
    else await mdb.createCollection('users', { validator, validationLevel: 'moderate', validationAction: 'error' });
    await mdb.collection('users').createIndex({ email: 1 }, { unique: true, name: 'unique_email' });
  } catch (err) {
    console.warn(`[db] Could not apply the account rules to MongoDB (${err.message}). The server still checks every sign-up.`);
  }
};

export const close = async () => { if (client) await client.close(); };

// ── GridFS ───────────────────────────────────
const buckets = new Map();
export const gridfs = (name) => {
  if (!buckets.has(name)) buckets.set(name, new GridFSBucket(mdb, { bucketName: name }));
  return buckets.get(name);
};
export const filesCollection = (bucketName) => mdb.collection(`${bucketName}.files`);

// ── State <-> collections ────────────────────
const lastJson = {};   // key -> Map(id -> json string last written)
const seqOf = {};      // key -> Map(id -> order number)
let counter = 0;

const ensureKey = (key) => {
  lastJson[key] ||= new Map();
  seqOf[key] ||= new Map();
};

// Returns the full state, or null when the database is empty (first run)
export const loadState = async () => {
  const meta = await mdb.collection('meta').findOne({ _id: 'meta' });
  if (!meta) return null;
  const state = { meta: meta.value };

  for (const key of Object.keys(ARRAYS)) {
    ensureKey(key);
    const docs = await mdb.collection(key).find({}).toArray();
    docs.sort((a, b) => (ARRAYS[key] ? b._seq - a._seq : a._seq - b._seq)); // restore array order
    state[key] = docs.map(({ _id, _seq, ...item }) => {
      lastJson[key].set(item.id, JSON.stringify(item));
      seqOf[key].set(item.id, _seq);
      counter = Math.max(counter, _seq);
      return item;
    });
  }
  for (const key of MAPS) {
    ensureKey(key);
    state[key] = {};
    for (const doc of await mdb.collection(key).find({}).toArray()) {
      state[key][doc._id] = doc.value;
      lastJson[key].set(doc._id, JSON.stringify(doc.value));
    }
  }
  lastJson.meta = new Map([['meta', JSON.stringify(state.meta)]]);
  return state;
};

// Writes whatever changed since the last successful call
export const persistState = async (state) => {
  const work = [];

  for (const [key, newestFirst] of Object.entries(ARRAYS)) {
    ensureKey(key);
    const items = state[key] || [];
    const ops = [];
    const nextJson = new Map();
    const seen = new Set();

    // Order numbers for items first seen now, so loading reproduces the array's order:
    // lists that grow at the front get the highest number for their first element
    const unseen = items.filter(item => !seqOf[key].has(item.id));
    for (const item of (newestFirst ? [...unseen].reverse() : unseen)) seqOf[key].set(item.id, ++counter);

    for (const item of items) {
      seen.add(item.id);
      const json = JSON.stringify(item);
      if (lastJson[key].get(item.id) === json) continue;
      ops.push({ replaceOne: { filter: { _id: item.id }, replacement: { ...item, _id: item.id, _seq: seqOf[key].get(item.id) }, upsert: true } });
      nextJson.set(item.id, json);
    }
    const removed = [...lastJson[key].keys()].filter(id => !seen.has(id));
    for (const id of removed) ops.push({ deleteOne: { filter: { _id: id } } });

    if (ops.length) {
      work.push(mdb.collection(key).bulkWrite(ops, { ordered: false }).then(() => {
        for (const [id, json] of nextJson) lastJson[key].set(id, json);
        for (const id of removed) { lastJson[key].delete(id); seqOf[key].delete(id); }
      }));
    }
  }

  for (const key of MAPS) {
    ensureKey(key);
    const map = state[key] || {};
    const ops = [];
    const nextJson = new Map();
    for (const [id, value] of Object.entries(map)) {
      const json = JSON.stringify(value);
      if (lastJson[key].get(id) === json) continue;
      ops.push({ replaceOne: { filter: { _id: id }, replacement: { _id: id, value }, upsert: true } });
      nextJson.set(id, json);
    }
    const removed = [...lastJson[key].keys()].filter(id => !(id in map));
    for (const id of removed) ops.push({ deleteOne: { filter: { _id: id } } });
    if (ops.length) {
      work.push(mdb.collection(key).bulkWrite(ops, { ordered: false }).then(() => {
        for (const [id, json] of nextJson) lastJson[key].set(id, json);
        for (const id of removed) lastJson[key].delete(id);
      }));
    }
  }

  const metaJson = JSON.stringify(state.meta || {});
  lastJson.meta ||= new Map();
  if (lastJson.meta.get('meta') !== metaJson) {
    work.push(mdb.collection('meta').replaceOne({ _id: 'meta' }, { _id: 'meta', value: state.meta || {} }, { upsert: true })
      .then(() => lastJson.meta.set('meta', metaJson)));
  }

  await Promise.all(work);
};
