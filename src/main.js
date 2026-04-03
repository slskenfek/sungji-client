// Phaser 부트스트랩만 담당한다.
// 백엔드의 main()처럼 게임 실행 시작점을 담당하는 파일이다.
(function bootstrapGame(global) {
  // Phaser.Game 생성 시 전달할 전역 런타임 설정.
  const config = {
    // 브라우저 환경에 맞춰 Canvas/WebGL 렌더러를 자동 선택한다.
    type: Phaser.AUTO,
    // 게임 캔버스가 붙을 DOM 요소 id.
    parent: "game-root",
    // 내부 좌표계 기준 해상도.
    width: 1280,
    height: 720,
    backgroundColor: "#081015",
    physics: {
      // 단순 2D 액션에 충분한 Arcade 물리 엔진 사용.
      default: "arcade",
      arcade: {
        debug: false,
      },
    },
    // 게임이 시작되면 가장 먼저 실행할 Scene.
    scene: [global.DungeonScene],
    scale: {
      // 브라우저 크기에 맞춰 비율 유지한 채 자동 리사이즈.
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };

  // 이 시점부터 Phaser의 preload/create/update 생명주기가 시작된다.
  global.dungeonGame = new Phaser.Game(config);
})(window);
