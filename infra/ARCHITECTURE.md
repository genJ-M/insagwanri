# 배포 아키텍처

## 전체 구조

```
┌──────────────────────────────────────────────────────────────────┐
│                         인터넷                                    │
└───────────────┬──────────────────────────┬───────────────────────┘
                │ HTTPS                     │ HTTPS
    ┌───────────▼───────────┐   ┌───────────▼───────────┐
    │       Vercel           │   │    CloudFront (CDN)    │
    │   Frontend (Next.js)   │   │   + WAF (방화벽)       │
    │   - 글로벌 엣지 배포    │   └───────────┬───────────┘
    │   - 자동 SSL            │               │
    └───────────────────────┘   ┌─────────────▼────────────────────┐
                                │           AWS VPC                 │
                                │                                   │
                                │  ┌─────────────────────────────┐ │
                                │  │    Application Load Balancer │ │
                                │  │    (HTTPS + 헬스체크)        │ │
                                │  └──────────┬──────────────────┘ │
                                │             │                     │
                                │  ┌──────────▼──────────────────┐ │
                                │  │      ECS Fargate Cluster     │ │
                                │  │                             │ │
                                │  │  ┌─────────┐ ┌─────────┐   │ │
                                │  │  │ NestJS  │ │ NestJS  │   │ │
                                │  │  │Task x1  │ │Task x2  │   │ │
                                │  │  └────┬────┘ └────┬────┘   │ │
                                │  └───────┼────────────┼────────┘ │
                                │          │  Private Subnet        │
                                │  ┌───────▼────────────▼───────┐  │
                                │  │      ElastiCache Redis      │  │
                                │  │      (세션 / 캐시)           │  │
                                │  └───────────────────────────┘  │
                                │                                   │
                                │  ┌─────────────────────────────┐ │
                                │  │     RDS PostgreSQL           │ │
                                │  │     Multi-AZ (자동 장애 복구)  │ │
                                │  │     + Read Replica          │ │
                                │  └─────────────────────────────┘ │
                                │                                   │
                                │  ┌─────────────────────────────┐ │
                                │  │     S3 Bucket               │ │
                                │  │     (파일 / 첨부자료)         │ │
                                │  └─────────────────────────────┘ │
                                └──────────────────────────────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │   OpenAI API       │
                                    │   (외부 서비스)      │
                                    └───────────────────┘

## 환경 구분

| 환경       | Frontend          | Backend            | DB                        |
|-----------|-------------------|--------------------|---------------------------|
| local     | localhost:3000    | localhost:3001     | Docker PostgreSQL         |
| staging   | staging.vercel.app| ECS (1 task)       | RDS t3.micro              |
| production| app.gwanriwang.com| ECS (2+ tasks)     | RDS r6g.large Multi-AZ    |

## 도메인 구조

app.gwanriwang.com       → Vercel (Frontend)
api.gwanriwang.com       → ALB → ECS (Backend)
staging.gwanriwang.com   → Vercel (Staging Frontend)
api-staging.gwanriwang.com → ECS Staging
```
