import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { CryptoService } from '../../common/crypto/crypto.service';

/**
 * 기존 평문 email/name 데이터를 암호화 컬럼으로 백필하는 서비스
 *
 * 앱 기동 시 1회 실행. email_hash가 null인 레코드에 대해서만 처리.
 * 이미 처리된 레코드는 스킵 (멱등성).
 */
@Injectable()
export class CryptoMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CryptoMigrationService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly cryptoService: CryptoService,
  ) {}

  async onApplicationBootstrap() {
    try {
      await this.backfillEncryption();
    } catch (err: any) {
      this.logger.warn(`암호화 백필 건너뜀 (마이그레이션 미실행 가능성): ${err?.message}`);
    }
  }

  private async backfillEncryption(): Promise<void> {
    // email_hash가 없는 레코드만 조회 (평문 email이 있는 레코드)
    const users = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.email', 'u.name'])
      .where('u.email_hash IS NULL')
      .andWhere('u.email IS NOT NULL')
      .withDeleted()
      .getMany();

    if (users.length === 0) return;

    this.logger.log(`암호화 백필 시작: ${users.length}명 처리`);

    let processed = 0;
    for (const user of users) {
      try {
        const emailHash = this.cryptoService.hmac(user.email.toLowerCase().trim());
        const emailEncrypted = this.cryptoService.encrypt(user.email.toLowerCase().trim());
        const nameEncrypted = user.name ? this.cryptoService.encrypt(user.name) : null;

        await this.userRepo
          .createQueryBuilder()
          .update(User)
          .set({ emailHash, emailEncrypted, nameEncrypted } as any)
          .where('id = :id', { id: user.id })
          .execute();

        processed++;
      } catch (err: any) {
        this.logger.warn(`백필 실패 userId=${user.id}: ${err?.message}`);
      }
    }

    this.logger.log(`암호화 백필 완료: ${processed}/${users.length}명`);
  }
}
