# AWS Lambda Function Cleaner

AWS Lambda 함수의 최신 버전만 남기고 이전 버전들을 자동으로 삭제하는 도구입니다.
Serverless Framework와 함께 사용할 수 있도록 최적화되어 있습니다.

## 기능

- **AWS Lambda 버전 관리** - Lambda 함수의 이전 버전들을 자동으로 삭제
- **Serverless Framework 호환** - Serverless Framework로 배포된 함수들과 완벽 호환
- **안전한 삭제** - 최신 버전은 항상 보존
- **드라이 런 지원** - 실제 삭제 전에 미리 확인 가능

## 설치

```bash
npm install
```

## 환경 설정

### AWS 자격 증명 설정

```bash
# AWS CLI 자격 증명 설정
aws configure

# 또는 환경 변수로 설정
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=ap-northeast-2
```

### Serverless Framework와 함께 사용

이 도구는 Serverless Framework로 배포된 Lambda 함수들과 완벽하게 호환됩니다.
Serverless Framework의 함수 이름 규칙을 자동으로 인식합니다.

#### Serverless Framework 함수 이름 패턴

- `my-service-dev-hello` - 서비스명-스테이지-함수명
- `my-service-prod-api` - 프로덕션 환경
- `my-service-staging-webhook` - 스테이징 환경

#### 사용 예시

```bash
# 특정 서비스의 모든 함수 정리
npm start -- --function-name my-service

# 특정 스테이지의 함수들만 정리
npm start -- --function-name my-service-dev

# 특정 함수만 정리
npm start -- --function-name my-service-dev-hello
```

## 사용법

### 기본 사용법

```bash
npm start
```

### 특정 지역의 함수만 정리

```bash
npm start -- --region us-east-1
npm start -- --region ap-northeast-2
```

### 드라이 런 (실제 삭제하지 않고 확인만)

```bash
npm start -- --dry-run
```

### 특정 함수만 정리

```bash
npm start -- --function-name my-function
```

### 강제 삭제 (확인 없이)

```bash
npm start -- --force
```

## 옵션

- `--region`: AWS 지역 지정 (기본값: ap-northeast-2)
- `--dry-run`: 실제 삭제하지 않고 확인만
- `--function-name`: 특정 함수 이름 지정
- `--force`: 확인 없이 강제 삭제
- `--help`: 도움말 표시

## 예시

```bash
# 모든 Lambda 함수의 이전 버전 정리
npm start

# 특정 지역의 함수들만 정리
npm start -- --region us-east-1

# 드라이 런 (실제 삭제하지 않고 확인만)
npm start -- --dry-run

# 특정 함수만 정리
npm start -- --function-name my-api-function --force

# Serverless Framework 함수 정리
npm start -- --function-name my-service-dev-hello
```

## 주의사항

⚠️ **이 도구는 함수의 이전 버전을 영구적으로 삭제합니다.**

- 삭제 전에 반드시 백업을 확인하세요
- 프로덕션 환경에서는 `--dry-run` 옵션을 먼저 사용하세요
- 삭제된 버전은 복구할 수 없습니다

## 라이선스

MIT
