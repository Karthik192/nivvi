import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { Platform } from 'react-native';
import { offlineOwner } from '../runtime';
import { runSync } from './sync';

export const OFFLINE_SYNC_TASK = 'nivvi-offline-sync-v1';
TaskManager.defineTask(OFFLINE_SYNC_TASK, async () => {
  try {
    const owner = await offlineOwner.get();
    if (!owner) return BackgroundTask.BackgroundTaskResult.Success;
    await runSync(owner);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function scheduleOfflineSync() {
  if (Platform.OS === 'web') return;
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
  const registered = await TaskManager.isTaskRegisteredAsync(OFFLINE_SYNC_TASK);
  if (!registered) await BackgroundTask.registerTaskAsync(OFFLINE_SYNC_TASK, { minimumInterval: 15 });
}

export async function stopOfflineSync() {
  if (Platform.OS === 'web') return;
  if (await TaskManager.isTaskRegisteredAsync(OFFLINE_SYNC_TASK))
    await BackgroundTask.unregisterTaskAsync(OFFLINE_SYNC_TASK);
}
