import { BaseRepository } from '../../../shared/repositories/base-repository.js';

export class DeviceTypeRepository extends BaseRepository {
  constructor(client) {
    super(client, 'device_types');
  }
}
