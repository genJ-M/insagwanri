# GitHub Secrets 설정 가이드

GitHub 저장소 Settings → Secrets and variables → Actions 에서 아래 시크릿을 등록하세요.

## 공통 (Repository Secrets)

| Secret 이름 | 값 | 설명 |
|-------------|-----|------|
| `AWS_ACCESS_KEY_ID` | AKIA... | CI/CD용 IAM 사용자 Access Key |
| `AWS_SECRET_ACCESS_KEY` | ... | IAM 사용자 Secret Key |
| `AWS_ACCOUNT_ID` | 123456789012 | AWS 계정 ID (12자리 숫자) |
| `SLACK_WEBHOOK_URL` | https://hooks.slack.com/... | 배포 알림용 Slack Incoming Webhook |

## staging Environment Secrets

Settings → Environments → staging 에서 등록

| Secret 이름 | 값 | 설명 |
|-------------|-----|------|
| `SUBNET_IDS` | subnet-xxx,subnet-yyy | ECS 태스크 실행용 Private Subnet ID |
| `SG_ID` | sg-xxx | ECS 태스크 Security Group ID |

## production Environment Secrets

Settings → Environments → production 에서 등록
**Required reviewers** 설정으로 수동 승인 게이트 추가 권장

| Secret 이름 | 값 | 설명 |
|-------------|-----|------|
| `SUBNET_IDS` | subnet-xxx,subnet-yyy | ECS 태스크 실행용 Private Subnet ID |
| `SG_ID` | sg-xxx | ECS 태스크 Security Group ID |

## IAM 정책 (CI/CD 전용 최소 권한)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:PutImage",
        "ecr:BatchGetImage"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecs:RegisterTaskDefinition",
        "ecs:DescribeTaskDefinition",
        "ecs:DescribeServices",
        "ecs:UpdateService",
        "ecs:RunTask",
        "ecs:DescribeTasks",
        "ecs:WaitUntilTasksStopped"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": [
        "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
        "arn:aws:iam::ACCOUNT_ID:role/gwanri-ecs-task-role"
      ]
    }
  ]
}
```

## 배포 흐름 요약

```
feature/* → PR → CI (tsc + build + docker build 검증)
                ↓ 승인 & 머지
develop → 자동 배포 → ECS Staging
                ↓ PR → 승인 & 머지
main    → 수동 승인 → ECS Production
```

## Vercel 연결

1. vercel.com → Add New Project → Import Git Repository
2. Root Directory: `web`
3. Environment Variables: `NEXT_PUBLIC_API_URL` 등록
4. GitHub 연동 시 PR마다 Preview URL 자동 생성됨
