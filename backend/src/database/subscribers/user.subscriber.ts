import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
  LoadEvent,
} from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import { CryptoService } from '../../common/crypto/crypto.service';

/**
 * User 엔티티 투명 암호화 Subscriber
 *
 * BeforeInsert / BeforeUpdate:
 *   email → emailHash (HMAC-SHA256) + emailEncrypted (AES-256-GCM)
 *   name  → nameEncrypted (AES-256-GCM)
 *
 * AfterLoad:
 *   emailEncrypted → email (복호화)
 *   nameEncrypted  → name  (복호화)
 */
@Injectable()
@EventSubscriber()
export class UserSubscriber implements EntitySubscriberInterface<User> {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cryptoService: CryptoService,
  ) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return User;
  }

  beforeInsert(event: InsertEvent<User>) {
    this.encryptFields(event.entity);
  }

  beforeUpdate(event: UpdateEvent<User>) {
    if (event.entity) {
      this.encryptFields(event.entity as User);
    }
  }

  afterLoad(entity: User) {
    this.decryptFields(entity);
  }

  private encryptFields(entity: User) {
    if (entity.email) {
      entity.emailHash = this.cryptoService.hmac(entity.email.toLowerCase().trim());
      entity.emailEncrypted = this.cryptoService.encrypt(entity.email.toLowerCase().trim());
    }
    if (entity.name) {
      entity.nameEncrypted = this.cryptoService.encrypt(entity.name);
    }
  }

  private decryptFields(entity: User) {
    if (entity.emailEncrypted) {
      try {
        entity.email = this.cryptoService.decrypt(entity.emailEncrypted);
      } catch {
        // 복호화 실패 시 기존 email 유지
      }
    }
    if (entity.nameEncrypted) {
      try {
        entity.name = this.cryptoService.decrypt(entity.nameEncrypted);
      } catch {
        // 복호화 실패 시 기존 name 유지
      }
    }
  }
}
