import { BaseRepository } from '../../../shared/repositories/base-repository.js';

export class SensorRepository extends BaseRepository {
  constructor(client) {
    super(client, 'sensors');
  }
}
