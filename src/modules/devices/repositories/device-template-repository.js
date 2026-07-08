import { BaseRepository } from '../../../shared/repositories/base-repository.js';

export class DeviceTemplateRepository extends BaseRepository {
  constructor(client) {
    super(client, 'device_templates');
  }
}
