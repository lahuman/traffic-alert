
# 교통 사고 알림 시스템

## 개요

이 프로젝트는 사용자가 지정한 위치 근처의 교통 사고에 대한 알림을 제공하기 위해 설계되었습니다. 시스템은 외부 소스로부터 교통 사고 데이터를 가져와 이를 처리하고, 지리 공간 데이터를 지원하는 PostGIS 확장 기능을 사용하는 PostgreSQL 데이터베이스에 저장합니다. 서버는 이 데이터를 API를 통해 제공하며, 사용자는 근처의 사고를 조회할 수 있습니다.

## 주요 기능

- **실시간 교통 사고 데이터**: 시스템은 외부 소스로부터 5분마다 교통 사고 데이터를 가져옵니다.
- **지리 공간 데이터 처리**: PostGIS 확장 기능을 사용하는 PostgreSQL을 활용하여 지리 공간 데이터를 저장하고, 근접 기반 검색을 효율적으로 수행할 수 있습니다.
- **보안된 API 접근**: API는 헤더에 `authkey`를 요구하며, 이를 통해 인증된 사용자만 교통 데이터를 조회할 수 있습니다.
- **도커 기반 설정**: PostgreSQL과 PostGIS는 Docker를 이용해 컨테이너화되어 있어 배포와 관리가 용이합니다.
- **PM2 프로세스 관리**: 서버와 스케줄링 작업은 PM2로 관리되어 신뢰성 있는 작동과 모니터링이 가능합니다.

## 시스템 구조

- **Docker**: PostgreSQL과 PostGIS는 Docker 컨테이너에서 실행되어 일관된 격리 환경을 유지합니다.
- **Node.js**: 애플리케이션 백엔드는 Node.js와 Express로 구축되었습니다.
  - **index.js**: 근접 기반의 교통 사고 데이터를 제공하는 API 요청을 처리합니다.
  - **schedule.js**: 5분마다 교통 데이터를 가져와 데이터베이스를 갱신합니다.
- **PM2**: Node.js 프로세스를 관리하여 서버(`index.js`)와 스케줄러(`schedule.js`)가 항상 실행되도록 하고, 장애 발생 시 자동으로 재시작합니다.

## 사전 준비 사항

- Docker
- Node.js
- PM2

## 설정 및 설치

### 1. 저장소 클론

```bash
git clone https://github.com/lahuman/traffic-alert.git
cd traffic-alert
```

### 2. 환경 변수 설정

프로젝트 루트 디렉토리에 `_env`를 `.env` 파일로 변경하고 다음 변수를 추가합니다:

```bash
DB_HOST=your_postgres_host
DB_PORT=your_postgres_port
DB_DB=your_database_name
DB_USER=your_database_user
DB_PW=your_database_password
TOKEN=your_external_api_token
AUTH_KEY=your_api_token
```

### 3. Docker를 이용한 PostgreSQL과 PostGIS 시작

```bash
docker run --name some-postgis -p 5432:5432 -e POSTGRES_PASSWORD=mysecretpassword -d postgis/postgis
```

이 명령어는 PostgreSQL과 PostGIS 컨테이너를 시작합니다.


### 4. Node.js 의존성 설치

```bash
npm install
```

### 5. 데이터베이스 초기화

PostgreSQL 컨테이너에 접속하여 PostGIS 확장을 초기화합니다

그런 다음 다음 SQL 명령을 실행합니다

교통 정보를 저장할 테이블을 생성합니다. 

```sql
CREATE EXTENSION postgis;

CREATE TABLE TRAFFIC_ALERT (
	"ID" VARCHAR(100) NOT NULL,
	"ADDRESS" VARCHAR(200) NULL,
	"TITLE" VARCHAR(500) NULL,
	"TYPE_CD" VARCHAR(4) NOT NULL,
	"SUB_CD" VARCHAR(4) NOT NULL,
	"LATITUDE" DOUBLE PRECISION NOT NULL,
	"LONGITUDE" DOUBLE PRECISION NOT NULL,
	"START_DTM" TIMESTAMP NULL,
	"END_DTM" TIMESTAMP NULL,
	"UPDATE_DTM" TIMESTAMP NULL,
	CONSTRAINT "PK_TRAFFIC_ALERT" PRIMARY KEY ("ID")
);
CREATE INDEX "IDX_TRAFFIC_ALERT_GEO" ON TRAFFIC_ALERT ("LATITUDE", "LONGITUDE");
```

### 6. 애플리케이션 시작

PM2를 사용하여 서버와 스케줄러를 시작합니다:

```bash
pm2 start "npm run start" --name traffic-server
pm2 start "npm run schedule" --name traffic-scheduler --cron "*/5 * * * *"
```

이 명령은 다음을 시작합니다:
- `index.js`: API 요청을 처리하는 서버.
- `schedule.js`: 5분마다 교통 데이터를 가져와 갱신하는 스크립트.

### 7. 애플리케이션 모니터링 및 관리

PM2를 사용하여 프로세스를 모니터링하고 관리할 수 있습니다:

```bash
pm2 list
pm2 logs
pm2 restart traffic-server
pm2 restart traffic-scheduler
```

## 사용법

### API 엔드포인트

- **GET /traffic-alert?lat={latitude}&lon={longitude}**

  이 엔드포인트는 지정된 위도와 경도 근처의 교통 사고를 반환합니다.

#### 예시 요청

```bash
curl -X GET "http://localhost:3000/traffic-alert?lat=37.4959854&lon=126.8879636" -H "authkey: AUTH_KEY"
```

### 응답 예제 

```json
[
    {
        "id": "incident_123",
        "address": "Guro-gu, Seoul",
        "title": "Traffic accident on the main road",
        "type_cd": "accident",
        "sub_cd": "collision",
        "latitude": 37.4959854,
        "longitude": 126.8879636,
        "start_dtm": "2023-09-01 10:00",
        "end_dtm": "2023-09-01 12:00",
        "update_dtm": "2023-09-01 10:05"
    }
]
```

## 기여하기

이 프로젝트에 기여하고 싶다면, 저장소를 포크한 후 풀 리퀘스트를 제출해주세요. 모든 기여를 환영합니다!

## 라이선스

이 프로젝트는 MIT 라이선스로 라이선스가 부여되어 있습니다.

## 참고 자료

- [도시교통정보센터-돌발정보](https://www.utic.go.kr/map/map.do?menu=incident&x=127.028&y=37.263)
- [docker-postgis](https://registry.hub.docker.com/r/postgis/postgis/)
- [NodeJS-ProgressBar](https://github.com/mratanusarkar/NodeJS-ProgressBar)