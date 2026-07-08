import { Client } from 'minio';
import { loadConfig } from './config.js';

export class ObjectStorageClient {
  constructor(config) {
    this.config = config;
    this.client = new Client({
      endPoint: config.endpoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey
    });
  }

  async bucketExists() {
    return this.client.bucketExists(this.config.bucket);
  }

  async ensureBucket() {
    const exists = await this.client.bucketExists(this.config.bucket).catch(() => false);
    if (!exists) {
      await this.client.makeBucket(this.config.bucket);
    }
    return { bucket: this.config.bucket };
  }

  async putObject(key, buffer, contentType = 'application/octet-stream') {
    await this.client.putObject(this.config.bucket, key, buffer, buffer.length, { 'Content-Type': contentType });
    return { bucket: this.config.bucket, key, size: buffer.length };
  }

  async getObjectStream(key) {
    return this.client.getObject(this.config.bucket, key);
  }

  async statObject(key) {
    return this.client.statObject(this.config.bucket, key);
  }
}

export const storageClient = new ObjectStorageClient(loadConfig().minio);
