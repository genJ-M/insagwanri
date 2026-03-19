import * as dotenv from 'dotenv';
import * as path from 'path';

// setupFiles는 ts-jest 변환을 거치므로 TypeScript 사용 가능
// globalSetup과 달리 각 테스트 파일 실행 직전에 호출됨
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
