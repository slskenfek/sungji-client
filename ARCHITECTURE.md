# JS 구조 정리

이 프로젝트는 Phaser 기반 브라우저 게임입니다.  
백엔드 서비스처럼 보면 `설정 -> 규칙 모듈 -> 렌더링 자원 -> UI -> 메인 씬` 순서로 읽으면 이해가 쉽습니다.

## 추천 읽기 순서

1. [`src/main.js`](/mnt/c/project/sungji/client/src/main.js)
2. [`src/config/game-config.js`](/mnt/c/project/sungji/client/src/config/game-config.js)
3. [`src/systems/leveling.js`](/mnt/c/project/sungji/client/src/systems/leveling.js)
4. [`src/entities/textures.js`](/mnt/c/project/sungji/client/src/entities/textures.js)
5. [`src/ui/hud.js`](/mnt/c/project/sungji/client/src/ui/hud.js)
6. [`src/scenes/dungeon-scene.js`](/mnt/c/project/sungji/client/src/scenes/dungeon-scene.js)

## 파일별 역할

### [`src/main.js`](/mnt/c/project/sungji/client/src/main.js)
게임 엔진 시작점입니다.

담당 기능:
- Phaser.Game 생성
- 캔버스 크기/스케일 설정
- 물리 엔진 설정
- 시작 Scene 등록

### [`src/config/game-config.js`](/mnt/c/project/sungji/client/src/config/game-config.js)
게임 밸런스와 초기 상수를 모아둔 설정 파일입니다.

담당 기능:
- 플레이어 기본 능력치
- 방 정보
- 스테이지 정보
- 월드 크기
- 몬스터 스폰/공격 수치
- 경험치 계산 기준값

### [`src/systems/leveling.js`](/mnt/c/project/sungji/client/src/systems/leveling.js)
레벨 관련 공식 전용 유틸입니다.

담당 기능:
- 다음 레벨 필요 경험치 계산
- 몬스터 레벨 결정
- 몬스터 경험치 보상 계산
- 몬스터 방어 배율 계산

### [`src/entities/textures.js`](/mnt/c/project/sungji/client/src/entities/textures.js)
게임 오브젝트의 시각 자원을 생성합니다.

담당 기능:
- 전사 포즈별 텍스처 생성
- 몬스터 변종/포즈 텍스처 생성
- 근접 공격/투사체 텍스처 생성
- 나무, 수풀, 연못, 바위, 꽃 텍스처 생성

중요 포인트:
- 이미지 파일을 읽는 구조가 아니라 코드로 직접 그리고 `generateTexture()`로 등록합니다.
- 나중에 Scene에서는 `"warrior-idle"`, `"terrain-tree"` 같은 key만 참조합니다.

### [`src/ui/hud.js`](/mnt/c/project/sungji/client/src/ui/hud.js)
상태 UI와 미니맵 프레임을 담당합니다.

담당 기능:
- 능력치 패널 생성
- HP/MP/EXP 바 렌더링
- 룸 이름 표시
- 미니맵 프레임/타이틀 생성
- Scene 상태를 UI 텍스트로 동기화

중요 포인트:
- 계산은 하지 않고 표시만 담당합니다.
- 실제 값은 Scene의 `playerState`에서 가져옵니다.

### [`src/scenes/dungeon-scene.js`](/mnt/c/project/sungji/client/src/scenes/dungeon-scene.js)
실제 게임 흐름을 총괄하는 핵심 파일입니다.

담당 기능:
- 맵 생성
- 플레이어 생성
- 몬스터 생성, 이동, 공격
- 플레이어 자동 공격
- 피해 계산
- 경험치/레벨업 처리
- 카메라 제어
- HUD 갱신

## 런타임 흐름

### 1. 시작
- [`src/main.js`](/mnt/c/project/sungji/client/src/main.js) 에서 Phaser.Game 생성
- [`src/scenes/dungeon-scene.js`](/mnt/c/project/sungji/client/src/scenes/dungeon-scene.js) 가 활성화됨

### 2. preload 단계
- [`src/entities/textures.js`](/mnt/c/project/sungji/client/src/entities/textures.js) 가 호출되어 텍스처 key를 미리 등록

### 3. create 단계
- 맵 생성
- 플레이어 생성
- 그룹 생성
- 카메라 생성
- 애니메이션 생성
- HUD 생성
- 스테이지 시작
- 입력 등록
- 몬스터 스폰 타이머 등록

### 4. update 단계
- 스테이지 진행 시간 체크
- 플레이어 이동 처리
- 몬스터 이동/공격 처리
- 플레이어 자동 공격 처리
- 투사체 추적 및 정리
- 플레이어 머리 위 HUD 위치 갱신

## 상태가 흘러가는 방식

### 핵심 상태 객체
핵심 상태는 [`src/scenes/dungeon-scene.js`](/mnt/c/project/sungji/client/src/scenes/dungeon-scene.js) 의 `this.playerState` 입니다.

이 안에 들어있는 대표 값:
- `hp`, `maxHp`
- `mp`, `maxMp`
- `xp`, `xpToNext`
- `level`
- `strength`, `dexterity`, `knowledge`, `defense`
- `attackRateStage`, `attackSpeed`, `damage`

### UI 갱신 흐름
흐름은 아래처럼 이해하면 됩니다.

`전투/레벨업 계산 -> playerState 변경 -> refreshUi() 호출 -> HUD 텍스트/바 갱신`

즉, UI는 상태의 원본이 아니고 결과를 보여주는 화면 계층입니다.

## 미니맵 구조

미니맵은 별도 이미지를 직접 그리는 구조가 아니라, 같은 월드를 다른 카메라로 한 번 더 보는 방식입니다.

관련 파일:
- 카메라 생성: [`src/scenes/dungeon-scene.js`](/mnt/c/project/sungji/client/src/scenes/dungeon-scene.js)
- 프레임 UI 생성: [`src/ui/hud.js`](/mnt/c/project/sungji/client/src/ui/hud.js)

구성:
- 메인 카메라: 실제 플레이 화면
- 미니맵 카메라: 작은 축소 화면
- HUD ignore 목록: 미니맵 안에 UI가 중복 렌더링되지 않게 차단

중요 포인트:
- 미니맵 가독성은 HUD 프레임보다 월드 지형 오브젝트에 더 크게 좌우됩니다.
- 그래서 미니맵 개선 시 [`src/scenes/dungeon-scene.js`](/mnt/c/project/sungji/client/src/scenes/dungeon-scene.js) 의 `createMap()`, `decorateTerrain()` 도 함께 봐야 합니다.

## 전투 흐름

### 플레이어 공격
- `handleAutoAttack()` 가 가까운 몬스터 탐색
- 쿨타임이 끝났으면 공격 실행
- `playMeleeAttack()` 로 모션 재생
- `damageMonster()` 로 실제 데미지 반영

### 몬스터 공격
- `updateMonsters()` 가 플레이어 추적
- 조건이 맞으면 `fireMonsterProjectile()` 호출
- 투사체가 플레이어에 닿으면 `handleProjectileHit()` 실행

## 스테이지 흐름

현재는 `풀숲 지대`를 배경으로 스테이지 번호가 계속 증가하는 반복 진행 구조입니다.

- 스테이지 시작 후 60초 동안 일반 몬스터가 계속 스폰
- 일반 몬스터 레벨은 플레이어 현재 레벨 범위와 스테이지별 최소 레벨 중 더 높은 기준으로 생성
- 60초가 지나면 일반 몬스터 웨이브 종료
- 이후 보스 1마리 등장
- 보스 처치 시 해당 레벨 몬스터 경험치의 10배와 스테이지 경험치 배율 적용
- 보스 처치 시 `STAGE CLEAR!` 화면과 `다음 스테이지 넘어가기` 버튼 표시
- 다음 스테이지 진입 시 레벨, 경험치, 장착 장비, 강화 수치, 인벤토리 유지
- 스테이지 번호에 따라 몬스터 레벨·체력·방어·공격력·속도 및 경험치·아이템 성능 증가
- 보스 드롭 장비는 `isBossDrop`으로 구분하며 강화 재료 사용 시 능력치의 120% 흡수

## 어디를 수정해야 하는지 빠른 가이드

### 플레이어 수치 변경
- [`src/config/game-config.js`](/mnt/c/project/sungji/client/src/config/game-config.js)
- [`src/scenes/dungeon-scene.js`](/mnt/c/project/sungji/client/src/scenes/dungeon-scene.js) 의 `recalculatePlayerStats()`

### 레벨링 공식 변경
- [`src/systems/leveling.js`](/mnt/c/project/sungji/client/src/systems/leveling.js)
- [`src/scenes/dungeon-scene.js`](/mnt/c/project/sungji/client/src/scenes/dungeon-scene.js) 의 `gainExperience()`

### 몬스터 AI 변경
- [`src/scenes/dungeon-scene.js`](/mnt/c/project/sungji/client/src/scenes/dungeon-scene.js) 의 `updateMonsters()`

### 미니맵/지형 변경
- [`src/scenes/dungeon-scene.js`](/mnt/c/project/sungji/client/src/scenes/dungeon-scene.js) 의 `createMap()`, `decorateTerrain()`
- [`src/ui/hud.js`](/mnt/c/project/sungji/client/src/ui/hud.js)
- [`src/entities/textures.js`](/mnt/c/project/sungji/client/src/entities/textures.js)

## 백엔드 개발자 관점에서 보면 좋은 포인트

이 프로젝트를 읽을 때는 아래 질문 순서가 가장 빠릅니다.

1. 상태 원본은 어디 있나
2. 계산은 어디서 하나
3. 화면 반영은 어디서 하나
4. 매 프레임 반복되는 루프는 어디인가

이 프로젝트의 답:
- 상태 원본: [`src/scenes/dungeon-scene.js`](/mnt/c/project/sungji/client/src/scenes/dungeon-scene.js) 의 `playerState`
- 계산: 같은 파일의 전투/레벨업 함수 + [`src/systems/leveling.js`](/mnt/c/project/sungji/client/src/systems/leveling.js)
- 화면 반영: [`src/ui/hud.js`](/mnt/c/project/sungji/client/src/ui/hud.js)
- 반복 루프: [`src/scenes/dungeon-scene.js`](/mnt/c/project/sungji/client/src/scenes/dungeon-scene.js) 의 `update()`
