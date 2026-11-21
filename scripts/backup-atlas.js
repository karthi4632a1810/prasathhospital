'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dns = require('dns');

// Ensure DNS resolves MongoDB Atlas SRV records
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('../backend/node_modules/mongoose');
const { EJSON } = require('../backend/node_modules/bson');
const env = require('../backend/src/config/env');

async function backupDatabase() {
  const start = Date.now();
  console.log('🚀 Connecting to MongoDB Atlas...');
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 15000 });

  const db = mongoose.connection.db;
  const dbName = db.databaseName || 'prashanth_events';

  // Format timestamp: YYYY-MM-DD_HH-mm-ss in local time
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(
    now.getHours()
  )}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

  const backupsRoot = path.resolve(__dirname, '../backups');
  const backupDir = path.join(backupsRoot, `mongodb_backup_${timestamp}`);
  fs.mkdirSync(backupDir, { recursive: true });

  console.log(`📁 Backup destination: ${backupDir}`);
  console.log(`📦 Database: ${dbName}\n`);

  const collections = await db.listCollections().toArray();
  const summary = [];
  const meta = {
    database: dbName,
    timestamp: now.toISOString(),
    collections: {},
  };

  let totalDocs = 0;

  for (const collInfo of collections) {
    const collName = collInfo.name;
    // Skip system collections
    if (collName.startsWith('system.')) continue;

    const coll = db.collection(collName);
    const docs = await coll.find({}).toArray();
    const indexes = await coll.indexes().catch(() => []);

    totalDocs += docs.length;

    // 1. Human-readable formatted JSON
    const jsonPath = path.join(backupDir, `${collName}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(docs, null, 2), 'utf-8');

    // 2. Canonical BSON Extended JSON (preserves ObjectId, Date, etc.)
    const ejsonPath = path.join(backupDir, `${collName}.ejson`);
    const ejsonLines = docs.map((d) => EJSON.stringify(d)).join('\n');
    fs.writeFileSync(ejsonPath, ejsonLines, 'utf-8');

    const jsonSize = (fs.statSync(jsonPath).size / 1024).toFixed(1) + ' KB';
    const ejsonSize = (fs.statSync(ejsonPath).size / 1024).toFixed(1) + ' KB';

    meta.collections[collName] = {
      count: docs.length,
      indexes,
    };

    summary.push({
      Collection: collName,
      Count: docs.length,
      'JSON Size': jsonSize,
      'EJSON Size': ejsonSize,
    });
  }

  // Save metadata & indexes
  fs.writeFileSync(path.join(backupDir, 'metadata.json'), JSON.stringify(meta, null, 2), 'utf-8');

  await mongoose.disconnect();

  console.table(summary);

  // Create compressed .tar.gz archive
  const archiveName = `mongodb_backup_${timestamp}.tar.gz`;
  const archivePath = path.join(backupsRoot, archiveName);

  console.log(`\n🗜️  Compressing backup into ${archiveName}...`);
  execSync(`tar -czf "${archivePath}" -C "${backupsRoot}" "mongodb_backup_${timestamp}"`);

  const archiveSize = (fs.statSync(archivePath).size / (1024 * 1024)).toFixed(2) + ' MB';
  const duration = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n✅ Backup successfully created in ${duration}s!`);
  console.log(`📄 Directory: ${backupDir}`);
  console.log(`📦 Compressed Archive: ${archivePath} (${archiveSize})`);
  console.log(`📊 Total Documents Saved: ${totalDocs}`);

  return {
    backupDir,
    archivePath,
    archiveSize,
    totalDocs,
    collectionCount: summary.length,
  };
}

backupDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Backup failed:', err);
    process.exit(1);
  });
