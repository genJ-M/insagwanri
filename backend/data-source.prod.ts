import { DataSource } from 'typeorm';

/**
 * 프로덕션 TypeORM DataSource (Render 배포용)
 * render.yaml startCommand: migration:run -d dist/data-source.prod.js
 */
export default new DataSource({
  type: 'postgres',
  // Render 내부 PostgreSQL — 개별 환경변수 사용
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
  synchronize: false,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/database/migrations/*.js'],
  migrationsTableName: 'migrations',
});
