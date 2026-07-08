import { BaseRepository } from '../../../shared/repositories/base-repository.js';

export class SiteRepository extends BaseRepository {
  constructor(client) {
    super(client, 'sites');
  }
}
