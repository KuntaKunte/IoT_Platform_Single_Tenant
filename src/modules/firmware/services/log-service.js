import { dbClient } from '../../../shared/database.js';
import { storageClient } from '../../../shared/storage.js';
import { getDevice } from '../../devices/services/device-service.js';
import { createCommand } from '../../commands/services/command-service.js';
import { LogCollectionRepository } from '../repositories/log-collection-repository.js';

const logCollectionRepository = new LogCollectionRepository(dbClient);

export async function requestLogCollection(deviceId) {
  await getDevice(deviceId);

  const collection = await logCollectionRepository.create({ deviceId });
  const command = await createCommand(deviceId, 'collect_logs', {
    collectionId: collection.id,
    uploadUrl: `/api/v1/devices/${deviceId}/logs/${collection.id}/upload`
  });
  return logCollectionRepository.linkCommand(collection.id, command.id);
}

async function getOwnedCollection(deviceId, collectionId) {
  const collection = await logCollectionRepository.findById(collectionId);
  if (!collection || collection.device_id !== deviceId) {
    throw Object.assign(new Error('Log collection not found'), { status: 404 });
  }
  return collection;
}

export async function recordUpload(deviceId, collectionId, fileBuffer, contentType) {
  await getDevice(deviceId);
  await getOwnedCollection(deviceId, collectionId);

  if (!fileBuffer || fileBuffer.length === 0) {
    throw Object.assign(new Error('A log file is required'), { status: 400 });
  }

  const storageKey = `logs/${deviceId}/${collectionId}/log.txt`;
  await storageClient.putObject(storageKey, fileBuffer, contentType || 'text/plain');
  return logCollectionRepository.markUploaded(collectionId, { storageKey, sizeBytes: fileBuffer.length });
}

export async function getCollections(deviceId) {
  await getDevice(deviceId);
  return logCollectionRepository.findByDevice(deviceId);
}

export async function downloadLogStream(deviceId, collectionId) {
  const collection = await getOwnedCollection(deviceId, collectionId);
  if (collection.status !== 'uploaded') {
    throw Object.assign(new Error('Log file has not been uploaded yet'), { status: 409 });
  }
  const stream = await storageClient.getObjectStream(collection.storage_key);
  return { stream, collection };
}
