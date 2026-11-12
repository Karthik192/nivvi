import { Platform } from 'react-native';
import * as contracts from '@nivvi/contracts';
import * as Network from 'expo-network';
import { ApiError } from '../client';
import { api, uuid, type RecordDTO } from '../runtime';
import * as map from '../mapping';
import {
  acknowledgeOutbox,
  applyPulledTransaction,
  conflictOutbox,
  deletePulledTransaction,
  failOutbox,
  getSyncCursor,
  markOutboxAttempt,
  nextOutbox,
  openOfflineDatabase,
  readOfflineCategories,
  readOfflineTransactions,
  retryBlockedConflict,
  saveSyncCursor,
  storeOfflineCategories,
  storeOfflineCategory,
} from './database';

let activeSync: Promise<void> | undefined;
export async function networkAvailable() {
  if (Platform.OS === 'web') return true;
  const state = await Network.getNetworkStateAsync();
  return state.isConnected === true && state.isInternetReachable !== false;
}

async function requestJson<T>(path: string) {
  return api.request<T>(path);
}

async function bootstrap(userId: string) {
  const current = await getSyncCursor(userId);
  if (current?.bootstrapped) return;
  let cursor = current?.bootstrap_cursor ?? null;
  let watermark = current?.sequence ?? '0';
  do {
    const page = await requestJson<{categories:RecordDTO[];transactions:RecordDTO[];watermark:string;cursor:string|null;hasMore:boolean}>(
      `/sync/bootstrap?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
    );
    if (!cursor) {
      watermark = page.watermark;
      await storeOfflineCategories(userId, page.categories);
    }
    for (const row of page.transactions) await applyPulledTransaction(userId, row);
    cursor = page.cursor;
    await saveSyncCursor(userId, watermark, cursor, false);
  } while (cursor);
  await saveSyncCursor(userId, watermark, null, true);
}

async function pull(userId: string) {
  const state = await getSyncCursor(userId);
  if (!state?.bootstrapped) return;
  let cursor = state.sequence;
  for (let pageCount = 0; pageCount < 100; pageCount++) {
    const result = await requestJson<{
      events: Array<{sequence:string;entityType:string;entityId:string;operation:string;payload:Record<string,unknown>}>;
      nextCursor:string; highWater:string; hasMore:boolean;
    }>(`/sync/pull?cursor=${encodeURIComponent(cursor)}&limit=100`);
    for (const event of result.events) {
      if (event.entityType === 'Transaction') {
        if (event.operation === 'DELETE' || event.payload.deletedAt) await deletePulledTransaction(userId, event.entityId, event.payload);
        else if (event.payload.userId === userId) await applyPulledTransaction(userId, event.payload);
      } else if (event.entityType === 'Category' && event.payload.userId === userId) {
        await storeOfflineCategory(userId, event.payload as {id:string});
      }
    }
    cursor = result.nextCursor;
    await saveSyncCursor(userId, cursor, null, true);
    if (!result.hasMore || cursor === result.highWater) break;
  }
}

async function flush(userId: string) {
  for (let count = 0; count < 100; count++) {
    const item = await nextOutbox(userId);
    if (!item) return;
    if(item.status!=='pending') return;
    if ((item.method === 'PATCH' || item.method === 'DELETE') && item.attempts === 0) {
      const db = await openOfflineDatabase();
      const local = await db.getFirstAsync<{payload_json:string}>('SELECT payload_json FROM local_transaction WHERE user_id=? AND id=?',userId,item.entity_id);
      if (local) {
        const record=JSON.parse(local.payload_json) as Record<string,unknown>;
        if (typeof record.version==='number') {
          if (item.method==='PATCH' && item.body_json) {
            const body=JSON.parse(item.body_json) as Record<string,unknown>;
            if(body.baseVersion!==record.version) {
              body.baseVersion=record.version;
              item.body_json=JSON.stringify(body);
              await db.runAsync('UPDATE outbox SET body_json=?,base_version=? WHERE seq=? AND attempts=0',item.body_json,record.version,item.seq);
            }
          } else if(item.method==='DELETE') {
            item.path=item.path.replace(/([?&]baseVersion=)[^&]*/,`$1${record.version}`);
            await db.runAsync('UPDATE outbox SET path=?,base_version=? WHERE seq=? AND attempts=0',item.path,record.version,item.seq);
          }
        }
      }
    }
    await markOutboxAttempt(item.seq);
    try {
      const result = await api.request<RecordDTO>(item.path, {
        method: item.method,
        ...(item.method === 'DELETE' ? {} : { body: item.body_json ?? undefined }),
        headers: { 'Idempotency-Key': item.operation_id },
      });
      await acknowledgeOutbox(item.seq,userId,item.entity_id,item.method==='DELETE' ? null : result);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const current=error.details?.current;
        await conflictOutbox(item.seq,userId,item.entity_id,current ?? null);
        return;
      }
      const status=error instanceof ApiError ? error.status : 0;
      const blocked=status>=400 && status<500 && status!==408 && status!==429;
      await failOutbox(item.seq,userId,item.entity_id,error instanceof ApiError ? error.code : 'NETWORK_ERROR',blocked);
      if(!blocked) {
        const delay=[1000,5000,15000,60000,300000,900000][Math.min(item.attempts,5)]!;
        setTimeout(()=>{ void runSync(userId).catch(()=>{}); },delay);
      }
      return;
    }
  }
}

export function runSync(userId: string) {
  if (Platform.OS === 'web') return Promise.resolve();
  if (activeSync) return activeSync;
  activeSync = (async () => {
    if (!(await networkAvailable())) return;
    await openOfflineDatabase();
    await bootstrap(userId);
    await flush(userId);
    await pull(userId);
  })().finally(() => { activeSync = undefined; });
  return activeSync;
}

export async function hydrateOffline(userId: string) {
  await openOfflineDatabase();
  const [categories, rawTransactions] = await Promise.all([
    readOfflineCategories(userId), readOfflineTransactions(userId),
  ]);
  return {
    categories: (categories as RecordDTO[]).map(map.category),
    transactions: (rawTransactions as (RecordDTO & {syncStatus:string;remoteConflict?:Record<string,unknown>})[]).map((row) => ({
      ...map.transaction(row),
      syncStatus: row.syncStatus as 'pending'|'synced'|'conflict',
      ...(row.remoteConflict ? { remoteConflict: row.remoteConflict } : {}),
    })).sort((a,b)=>Date.parse(b.occurredAt??b.date)-Date.parse(a.occurredAt??a.date)||Date.parse(b.createdAt)-Date.parse(a.createdAt)),
  };
}

export async function saveOfflineTransaction(input: {
  userId:string; operationId:string; id:string; method:'POST'|'PATCH'|'DELETE'; path:string;
  body:unknown; local:Record<string,unknown>; baseVersion?:number;
}) {
  const db=await openOfflineDatabase();
  await db.withExclusiveTransactionAsync(async(tx)=>{
    const state=input.method==='DELETE'?'pending-delete':'pending';
    await tx.runAsync('INSERT OR REPLACE INTO local_transaction(user_id,id,payload_json,sync_status,conflict_json) VALUES (?,?,?,?,NULL)',input.userId,input.id,JSON.stringify({...input.local,syncStatus:state}),state);
    await tx.runAsync('INSERT INTO outbox(user_id,operation_id,entity_id,method,path,body_json,base_version) VALUES (?,?,?,?,?,?,?)',input.userId,input.operationId,input.id,input.method,input.path,input.body==null?null:JSON.stringify(input.body),input.baseVersion??null);
  });
}

export function newOperationId() { return uuid(); }
export async function currentConflict(userId:string,id:string) {
  const db=await openOfflineDatabase();
  const row=await db.getFirstAsync<{seq:number;payload_json:string;conflict_json:string|null}>('SELECT seq,local_transaction.payload_json,local_transaction.conflict_json FROM local_transaction JOIN outbox ON outbox.user_id=local_transaction.user_id AND outbox.entity_id=local_transaction.id WHERE local_transaction.user_id=? AND local_transaction.id=? AND outbox.status=\'blocked\' LIMIT 1',userId,id);
  return row ? { seq:row.seq, local:JSON.parse(row.payload_json) as Record<string,unknown>, remote:row.conflict_json ? JSON.parse(row.conflict_json) as Record<string,unknown> : null } : null;
}
export async function resolveServerVersion(userId:string,id:string) {
  const conflict=await currentConflict(userId,id);
  if(!conflict) throw new Error('There is no saved conflict to resolve.');
  const {clearOutboxForConflict}=await import('./database');
  await clearOutboxForConflict(conflict.seq,userId,id,conflict.remote);
  await pull(userId);
}
export async function keepLocalChanges(userId:string,id:string) {
  const conflict=await currentConflict(userId,id);
  if(!conflict) throw new Error('There is no saved conflict to resolve.');
  if(!conflict.remote||conflict.remote.deletedAt) throw new Error('This entry was removed on the account. Save it as a new entry after reviewing it.');
  const version=Number(conflict.remote.version);
  if(!Number.isSafeInteger(version)||version<1) throw new Error('The account version is unavailable.');
  const body=contracts.transactionPatch.parse({
    amountMinor:String(conflict.local.amountMinor),currency:'INR',categoryId:String(conflict.local.categoryId),
    description:conflict.local.description??null,merchantOrPayee:conflict.local.merchantOrPayee??null,
    paymentMethod:conflict.local.paymentMethod,occurredAt:conflict.local.occurredAt,baseVersion:version,
  });
  const local={...conflict.local,version,syncStatus:'pending'};
  await retryBlockedConflict(userId,id,newOperationId(),body,local,version,`/transactions/${id}`);
  await runSync(userId);
}
