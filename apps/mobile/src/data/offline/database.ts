import { Platform } from 'react-native';
import type * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';

const dbName = 'nivvi-offline.db';
const keyName = 'nivvi.sqlite.key.v1';
let opening: Promise<SQLite.SQLiteDatabase> | undefined;
let database: SQLite.SQLiteDatabase | undefined;

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function openOfflineDatabase() {
  if (Platform.OS === 'web') throw new Error('Offline storage is available in the Android app.');
  if (database) return database;
  opening ??= (async () => {
    const secureStore = await import('expo-secure-store');
    let key = await secureStore.getItemAsync(keyName);
    if (!key) {
      const crypto = await import('expo-crypto');
      key = hex(await crypto.getRandomBytesAsync(32));
      await secureStore.setItemAsync(keyName, key, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Local finance storage key is invalid.');
    const sqlite = await import('expo-sqlite');
    const db = await sqlite.openDatabaseAsync(dbName);
    await db.execAsync(`PRAGMA key = "x'${key}'";`);
    const cipher = await db.getFirstAsync<{ cipher_version: string | null }>('PRAGMA cipher_version;');
    if (!cipher?.cipher_version) {
      await db.closeAsync();
      throw new Error('Encrypted local storage is unavailable. Update the app before saving offline.');
    }
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS local_profile (
        user_id TEXT PRIMARY KEY NOT NULL, payload_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS local_category (
        user_id TEXT NOT NULL, id TEXT NOT NULL, payload_json TEXT NOT NULL,
        PRIMARY KEY(user_id,id)
      );
      CREATE TABLE IF NOT EXISTS local_transaction (
        user_id TEXT NOT NULL, id TEXT NOT NULL, payload_json TEXT NOT NULL,
        sync_status TEXT NOT NULL CHECK(sync_status IN ('pending','synced','conflict','pending-delete')),
        conflict_json TEXT, PRIMARY KEY(user_id,id)
      );
      CREATE TABLE IF NOT EXISTS outbox (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL,
        operation_id TEXT NOT NULL, entity_id TEXT NOT NULL, method TEXT NOT NULL,
        path TEXT NOT NULL, body_json TEXT, base_version INTEGER,
        status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_error TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id,operation_id)
      );
      CREATE INDEX IF NOT EXISTS outbox_account_order ON outbox(user_id,status,seq);
      CREATE TABLE IF NOT EXISTS sync_cursor (
        user_id TEXT PRIMARY KEY NOT NULL, sequence TEXT NOT NULL DEFAULT '0',
        bootstrap_cursor TEXT, bootstrapped INTEGER NOT NULL DEFAULT 0
      );
    `);
    const outboxColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(outbox)');
    if (!outboxColumns.some((column) => column.name === 'next_attempt_at'))
      await db.execAsync("ALTER TABLE outbox ADD COLUMN next_attempt_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';");
    database = db;
    return db;
  })().catch((error) => {
    opening = undefined;
    throw error;
  });
  return opening;
}

export async function closeOfflineDatabase() {
  if (database) await database.closeAsync();
  database = undefined;
  opening = undefined;
}

export async function storeOfflineProfile(userId: string, profile: unknown) {
  const db = await openOfflineDatabase();
  await db.runAsync('INSERT OR REPLACE INTO local_profile(user_id,payload_json) VALUES (?,?)', userId, JSON.stringify(profile));
}
export async function readOfflineProfile(userId: string) {
  const db = await openOfflineDatabase();
  const row = await db.getFirstAsync<{ payload_json: string }>('SELECT payload_json FROM local_profile WHERE user_id=?', userId);
  return row ? JSON.parse(row.payload_json) : null;
}
export async function storeOfflineCategories(userId: string, categories: unknown[]) {
  const db = await openOfflineDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const category of categories as { id: string }[])
      await tx.runAsync('INSERT OR REPLACE INTO local_category(user_id,id,payload_json) VALUES (?,?,?)', userId, category.id, JSON.stringify(category));
  });
}
export async function storeOfflineCategory(userId: string, category: { id: string }) {
  const db = await openOfflineDatabase();
  await db.runAsync('INSERT OR REPLACE INTO local_category(user_id,id,payload_json) VALUES (?,?,?)', userId, category.id, JSON.stringify(category));
}
export async function readOfflineCategories(userId: string) {
  const db = await openOfflineDatabase();
  const rows = await db.getAllAsync<{ payload_json: string }>('SELECT payload_json FROM local_category WHERE user_id=? ORDER BY id', userId);
  return rows.map((row) => JSON.parse(row.payload_json));
}
export async function readOfflineTransactions(userId: string) {
  const db = await openOfflineDatabase();
  const rows = await db.getAllAsync<{ payload_json: string; sync_status: string; conflict_json: string | null }>('SELECT payload_json,sync_status,conflict_json FROM local_transaction WHERE user_id=? AND sync_status <> \'pending-delete\'', userId);
  return rows.map((row) => ({ ...JSON.parse(row.payload_json), syncStatus: row.sync_status, ...(row.conflict_json ? { remoteConflict: JSON.parse(row.conflict_json) } : {}) }));
}
export async function enqueueTransaction(input: {
  userId: string; id: string; operationId: string; method: 'POST'|'PATCH'|'DELETE'; path: string;
  body: unknown; local: unknown; baseVersion?: number;
}) {
  const db = await openOfflineDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('INSERT OR REPLACE INTO local_transaction(user_id,id,payload_json,sync_status,conflict_json) VALUES (?,?,?,\'pending\',NULL)', input.userId, input.id, JSON.stringify(input.local));
    await tx.runAsync('INSERT INTO outbox(user_id,operation_id,entity_id,method,path,body_json,base_version) VALUES (?,?,?,?,?,?,?)', input.userId, input.operationId, input.id, input.method, input.path, input.body == null ? null : JSON.stringify(input.body), input.baseVersion ?? null);
  });
}
export async function nextOutbox(userId: string) {
  const db = await openOfflineDatabase();
  const item = await db.getFirstAsync<{ seq:number; operation_id:string; entity_id:string; method:string; path:string; body_json:string|null; base_version:number|null; attempts:number; status:string; next_attempt_at:string }>('SELECT seq,operation_id,entity_id,method,path,body_json,base_version,attempts,status,next_attempt_at FROM outbox WHERE user_id=? ORDER BY seq LIMIT 1', userId);
  if(item?.status==='pending'&&new Date(item.next_attempt_at).getTime()>Date.now()) return null;
  return item;
}
export async function markOutboxAttempt(seq: number) {
  const db = await openOfflineDatabase();
  await db.runAsync('UPDATE outbox SET attempts=attempts+1 WHERE seq=?', seq);
}
export async function failOutbox(seq: number, userId: string, id: string, error: string, blocked: boolean) {
  const db = await openOfflineDatabase();
  await db.withExclusiveTransactionAsync(async(tx)=>{
    const row=await tx.getFirstAsync<{attempts:number}>('SELECT attempts FROM outbox WHERE seq=?',seq);
    const delay=[1000,5000,15000,60000,300000,900000][Math.min(Math.max((row?.attempts??1)-1,0),5)]!;
    await tx.runAsync('UPDATE outbox SET status=?,last_error=?,next_attempt_at=? WHERE seq=?', blocked ? 'blocked' : 'pending', error.slice(0, 100), new Date(Date.now()+delay).toISOString(), seq);
    if(blocked) await tx.runAsync('UPDATE local_transaction SET sync_status=\'conflict\',conflict_json=NULL WHERE user_id=? AND id=?',userId,id);
  });
}
export async function acknowledgeOutbox(seq: number, userId: string, id: string, payload: unknown) {
  const db = await openOfflineDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    if (payload == null) await tx.runAsync('DELETE FROM local_transaction WHERE user_id=? AND id=?', userId, id);
    else {
      const later=await tx.getFirstAsync<{seq:number}>('SELECT seq FROM outbox WHERE user_id=? AND entity_id=? AND seq>? LIMIT 1',userId,id,seq);
      if(later) {
        const current=await tx.getFirstAsync<{payload_json:string;sync_status:string}>('SELECT payload_json,sync_status FROM local_transaction WHERE user_id=? AND id=?',userId,id);
        if(current) {
          const local=JSON.parse(current.payload_json) as Record<string,unknown>;
          const server=payload as Record<string,unknown>;
          const merged={...local,version:server.version,serverVersion:server.version,createdAt:server.createdAt,updatedAt:server.updatedAt};
          await tx.runAsync('UPDATE local_transaction SET payload_json=?,conflict_json=NULL WHERE user_id=? AND id=?',JSON.stringify(merged),userId,id);
        }
      } else await tx.runAsync('INSERT OR REPLACE INTO local_transaction(user_id,id,payload_json,sync_status,conflict_json) VALUES (?,?,?,\'synced\',NULL)', userId, id, JSON.stringify(payload));
    }
    await tx.runAsync('DELETE FROM outbox WHERE seq=?', seq);
  });
}
export async function conflictOutbox(seq: number, userId: string, id: string, remote: unknown) {
  const db = await openOfflineDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('UPDATE outbox SET status=\'blocked\',last_error=\'CONFLICT\' WHERE seq=?', seq);
    await tx.runAsync('UPDATE local_transaction SET sync_status=\'conflict\',conflict_json=? WHERE user_id=? AND id=?', JSON.stringify(remote), userId, id);
  });
}
export async function clearOutboxForConflict(seq:number, userId:string, id:string, remote:unknown|null) {
  const db=await openOfflineDatabase();
  await db.withExclusiveTransactionAsync(async(tx)=>{
    await tx.runAsync('DELETE FROM outbox WHERE seq=?',seq);
    if(remote===null||(typeof remote==='object'&&remote!==null&&'deletedAt' in remote&&(remote as {deletedAt:unknown}).deletedAt)) await tx.runAsync('DELETE FROM local_transaction WHERE user_id=? AND id=?',userId,id);
    else await tx.runAsync('INSERT OR REPLACE INTO local_transaction(user_id,id,payload_json,sync_status,conflict_json) VALUES(?,?,?,\'synced\',NULL)',userId,id,JSON.stringify(remote));
  });
}
export async function getBlockedOutbox(userId:string,id:string) {
  const db=await openOfflineDatabase();
  return db.getFirstAsync<{seq:number}>('SELECT seq FROM outbox WHERE user_id=? AND entity_id=? AND status=\'blocked\' ORDER BY seq LIMIT 1',userId,id);
}
export async function replaceConflictWithNewOperation(seq:number,userId:string,id:string,opId:string,body:unknown,local:unknown,version:number,path:string) {
  const db=await openOfflineDatabase();
  await db.withExclusiveTransactionAsync(async(tx)=>{
    await tx.runAsync('DELETE FROM outbox WHERE seq=?',seq);
    await tx.runAsync('UPDATE local_transaction SET payload_json=?,sync_status=\'pending\',conflict_json=NULL WHERE user_id=? AND id=?',JSON.stringify(local),userId,id);
    await tx.runAsync('INSERT INTO outbox(user_id,operation_id,entity_id,method,path,body_json,base_version) VALUES (?,?,?,\'PATCH\',?,?,?)',userId,opId,id,path,JSON.stringify(body),version);
  });
}
export async function getSyncCursor(userId:string) {
  const db=await openOfflineDatabase();
  return db.getFirstAsync<{sequence:string;bootstrap_cursor:string|null;bootstrapped:number}>('SELECT sequence,bootstrap_cursor,bootstrapped FROM sync_cursor WHERE user_id=?',userId);
}
export async function saveSyncCursor(userId:string,sequence:string,bootstrapCursor:string|null,bootstrapped:boolean) {
  const db=await openOfflineDatabase();
  await db.runAsync('INSERT OR REPLACE INTO sync_cursor(user_id,sequence,bootstrap_cursor,bootstrapped) VALUES (?,?,?,?)',userId,sequence,bootstrapCursor,bootstrapped?1:0);
}
export async function applyPulledTransaction(userId:string,row:Record<string,unknown>) {
  const db=await openOfflineDatabase();
  const existing=await db.getFirstAsync<{sync_status:string;payload_json:string}>('SELECT sync_status,payload_json FROM local_transaction WHERE user_id=? AND id=?',userId,String(row.id));
  if(existing?.sync_status==='pending'||existing?.sync_status==='conflict') {
    const local=JSON.parse(existing.payload_json) as Record<string,unknown>;
    if(existing.sync_status==='pending'&&Number(local.serverVersion??local.version)===Number(row.version)) return;
    await db.runAsync('UPDATE local_transaction SET sync_status=\'conflict\',conflict_json=? WHERE user_id=? AND id=?',JSON.stringify(row),userId,String(row.id));
    return;
  }
  await db.runAsync('INSERT OR REPLACE INTO local_transaction(user_id,id,payload_json,sync_status,conflict_json) VALUES (?,?,?,\'synced\',NULL)',userId,String(row.id),JSON.stringify(row));
}
export async function deletePulledTransaction(userId:string,id:string,remote?:unknown) {
  const db=await openOfflineDatabase();
  const local=await db.getFirstAsync<{sync_status:string}>('SELECT sync_status FROM local_transaction WHERE user_id=? AND id=?',userId,id);
  if(local?.sync_status==='pending'||local?.sync_status==='conflict') {
    await db.runAsync('UPDATE local_transaction SET sync_status=\'conflict\',conflict_json=? WHERE user_id=? AND id=?',JSON.stringify(remote ?? {id,deletedAt:true}),userId,id);
    return;
  }
  await db.runAsync('DELETE FROM local_transaction WHERE user_id=? AND id=?',userId,id);
}
export async function retryBlockedConflict(userId:string,id:string,newOperationId:string,body:unknown,local:unknown,version:number,path:string) {
  const db=await openOfflineDatabase();
  await db.withExclusiveTransactionAsync(async(tx)=>{
    const blocked=await tx.getFirstAsync<{seq:number}>('SELECT seq FROM outbox WHERE user_id=? AND entity_id=? AND status=\'blocked\' ORDER BY seq LIMIT 1',userId,id);
    if(!blocked) throw new Error('There is no saved conflict to resolve.');
    await tx.runAsync('DELETE FROM outbox WHERE seq=?',blocked.seq);
    await tx.runAsync('UPDATE local_transaction SET payload_json=?,sync_status=\'pending\',conflict_json=NULL WHERE user_id=? AND id=?',JSON.stringify(local),userId,id);
    await tx.runAsync('INSERT INTO outbox(user_id,operation_id,entity_id,method,path,body_json,base_version) VALUES (?,?,?,\'PATCH\',?,?,?)',userId,newOperationId,id,path,JSON.stringify(body),version);
  });
}
