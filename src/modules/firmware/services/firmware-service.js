import crypto from 'crypto';
import { dbClient } from '../../../shared/database.js';
import { storageClient } from '../../../shared/storage.js';
import { getDevice } from '../../devices/services/device-service.js';
import { createCommand } from '../../commands/services/command-service.js';
import { uploadFirmwareSchema, deployFirmwareSchema } from '../validation.js';
import { FirmwareVersionRepository } from '../repositories/firmware-version-repository.js';
import { FirmwareDeploymentRepository } from '../repositories/firmware-deployment-repository.js';

const firmwareVersionRepository = new FirmwareVersionRepository(dbClient);
const firmwareDeploymentRepository = new FirmwareDeploymentRepository(dbClient);

export async function uploadFirmware(input, fileBuffer, contentType) {
  const { error, value } = uploadFirmwareSchema.validate(input);
  if (error) {
    throw Object.assign(new Error(error.details[0].message), { status: 400 });
  }
  if (!fileBuffer || fileBuffer.length === 0) {
    throw Object.assign(new Error('A firmware file is required'), { status: 400 });
  }

  const existing = await firmwareVersionRepository.findByTypeAndVersion(value.deviceType, value.version);
  if (existing) {
    throw Object.assign(new Error('This device type/version has already been uploaded'), { status: 409 });
  }

  const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const storageKey = `firmware/${value.deviceType}/${value.version}/${value.version}.bin`;
  await storageClient.putObject(storageKey, fileBuffer, contentType);

  return firmwareVersionRepository.create({
    device_type: value.deviceType,
    version: value.version,
    description: value.description || null,
    storage_key: storageKey,
    size_bytes: fileBuffer.length,
    checksum,
    content_type: contentType
  });
}

export async function listFirmware({ deviceType } = {}) {
  if (deviceType) {
    return firmwareVersionRepository.findByDeviceType(deviceType);
  }
  return firmwareVersionRepository.findAll();
}

export async function getFirmware(id) {
  const firmware = await firmwareVersionRepository.findById(id);
  if (!firmware) {
    throw Object.assign(new Error('Firmware not found'), { status: 404 });
  }
  return firmware;
}

export async function downloadFirmwareStream(id) {
  const firmware = await getFirmware(id);
  const stream = await storageClient.getObjectStream(firmware.storage_key);
  return { stream, firmware };
}

export async function deployFirmware(deviceId, input, { isRollback = false } = {}) {
  const { error, value } = deployFirmwareSchema.validate(input);
  if (error) {
    throw Object.assign(new Error(error.details[0].message), { status: 400 });
  }

  const device = await getDevice(deviceId);
  const firmware = await getFirmware(value.firmwareId);

  if (device.device_type !== firmware.device_type) {
    throw Object.assign(
      new Error(`Firmware is built for device type "${firmware.device_type}", not "${device.device_type}"`),
      { status: 400 }
    );
  }

  const command = await createCommand(deviceId, 'firmware_update', {
    firmwareId: firmware.id,
    version: firmware.version,
    checksum: firmware.checksum,
    sizeBytes: Number(firmware.size_bytes),
    downloadUrl: `/api/v1/firmware/${firmware.id}/download`
  });

  return firmwareDeploymentRepository.create({
    deviceId,
    firmwareId: firmware.id,
    commandId: command.id,
    isRollback
  });
}

export async function getDeployments(deviceId) {
  await getDevice(deviceId);
  return firmwareDeploymentRepository.findByDevice(deviceId);
}

export async function getCurrentFirmware(deviceId) {
  await getDevice(deviceId);
  return firmwareDeploymentRepository.findLatestSuccessful(deviceId);
}

export async function rollbackFirmware(deviceId) {
  await getDevice(deviceId);

  const current = await firmwareDeploymentRepository.findLatestSuccessful(deviceId);
  if (!current) {
    throw Object.assign(new Error('No successful firmware deployment to roll back from'), { status: 409 });
  }

  const previous = await firmwareDeploymentRepository.findLatestSuccessful(deviceId, { excludeId: current.id });
  if (!previous) {
    throw Object.assign(new Error('No earlier successful firmware deployment to roll back to'), { status: 409 });
  }

  return deployFirmware(deviceId, { firmwareId: previous.firmware_id }, { isRollback: true });
}
