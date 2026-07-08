import { BaseRepository } from '../../../shared/repositories/base-repository.js';

export class AssetRepository extends BaseRepository {
  constructor(client) {
    super(client, 'assets');
  }
}
