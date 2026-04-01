// Phaser 부트스트랩만 담당한다.
(function bootstrapGame(global) {
  const config = {
    type: Phaser.AUTO,
    parent: "game-root",
    width: 1280,
    height: 720,
    backgroundColor: "#081015",
    physics: {
      default: "arcade",
      arcade: {
        debug: false,
      },
    },
    scene: [global.DungeonScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  };

  global.dungeonGame = new Phaser.Game(config);
})(window);
