import * as dotenv from 'dotenv';
import * as path from 'path';

export default async function globalSetup() {
  // .env.test 로드 (존재하는 경우)
  dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
}
