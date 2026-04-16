import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateShiftSwapRequests1746400000000 implements MigrationInterface {
  name = 'CreateShiftSwapRequests1746400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "shift_swap_requests" (
        "id"                         UUID         DEFAULT gen_random_uuid() NOT NULL,
        "company_id"                 UUID         NOT NULL,
        "requester_id"               UUID         NOT NULL,
        "requester_assignment_id"    UUID,
        "requester_shift_snapshot"   JSONB,
        "target_user_id"             UUID,
        "target_assignment_id"       UUID,
        "target_shift_snapshot"      JSONB,
        "type"                       VARCHAR(10)  NOT NULL,
        "status"                     VARCHAR(20)  NOT NULL DEFAULT 'pending_peer',
        "requester_note"             TEXT,
        "peer_note"                  TEXT,
        "approver_id"                UUID,
        "approver_note"              TEXT,
        "approved_at"                TIMESTAMPTZ,
        "created_at"                 TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updated_at"                 TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shift_swap_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ssr_company"
          FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ssr_requester"
          FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ssr_target_user"
          FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_ssr_requester_assignment"
          FOREIGN KEY ("requester_assignment_id") REFERENCES "shift_assignments"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_ssr_target_assignment"
          FOREIGN KEY ("target_assignment_id") REFERENCES "shift_assignments"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_ssr_approver"
          FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_ssr_company_status" ON "shift_swap_requests" ("company_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_ssr_requester"      ON "shift_swap_requests" ("requester_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_ssr_target_user"    ON "shift_swap_requests" ("target_user_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "shift_swap_requests"`);
  }
}
