-- 로컬 개발 DB 초기화
-- docker-compose 최초 실행 시 자동 실행됨

-- UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 스테이징 DB 생성 (로컬에서 두 환경 테스트 시)
CREATE DATABASE gwanri_wang_staging;

-- 접속 권한
GRANT ALL PRIVILEGES ON DATABASE gwanri_wang TO postgres;
GRANT ALL PRIVILEGES ON DATABASE gwanri_wang_staging TO postgres;
