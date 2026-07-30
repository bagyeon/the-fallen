import Phaser from 'phaser';

export default class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, 'placeholder').setScale(1).setTint(0x99ddff);

    this.cursors = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      fire: Phaser.Input.Keyboard.KeyCodes.K,
      melee: Phaser.Input.Keyboard.KeyCodes.J,
      reload: Phaser.Input.Keyboard.KeyCodes.R
    });

    this.speed = 200;

    this.bullets = scene.physics.add.group({ classType: Phaser.GameObjects.Image, runChildUpdate: true });
    this.maxAmmo = 6;
    this.ammo = this.maxAmmo;
    this.reloading = false;
    this.reloadTime = 1000; // ms

    this.meleeCharging = false;
    this.meleeChargeTime = 0;
    this.meleeThreshold = 500;
  }

  update(time, delta) {
    const body = this.sprite.body;
    body.setVelocityX(0);

    if (this.cursors.left.isDown) body.setVelocityX(-this.speed);
    else if (this.cursors.right.isDown) body.setVelocityX(this.speed);

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) && body.onFloor()) {
      body.setVelocityY(-450);
    }

    // Shooting
    if (Phaser.Input.Keyboard.JustDown(this.cursors.fire) && !this.reloading) {
      if (this.ammo > 0) {
        this.shoot();
        this.ammo--;
        if (this.ammo === 0) this.startReload();
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.cursors.reload)) this.startReload();

    // Melee charge
    if (this.cursors.melee.isDown) {
      this.meleeCharging = true;
      this.meleeChargeTime += delta;
    } else if (this.meleeCharging) {
      if (this.meleeChargeTime >= this.meleeThreshold) {
        this.meleeAttack();
      }
      this.meleeCharging = false;
      this.meleeChargeTime = 0;
    }
  }

  shoot() {
    const x = this.sprite.x + 40;
    const y = this.sprite.y;
    const bullet = this.scene.physics.add.image(x, y, 'placeholder').setScale(0.2).setTint(0xffffaa);
    bullet.body.allowGravity = false;
    bullet.setVelocityX(600);
    this.bullets.add(bullet);

    this.scene.time.delayedCall(3000, () => { if (bullet && bullet.destroy) bullet.destroy(); });
  }

  startReload() {
    if (this.reloading) return;
    this.reloading = true;
    this.scene.time.delayedCall(this.reloadTime, () => { this.ammo = this.maxAmmo; this.reloading = false; });
  }

  meleeAttack() {
    // create short-lived hitbox in front
    const hit = this.scene.add.rectangle(this.sprite.x + 60, this.sprite.y, 80, 40, 0xffddaa, 0.5);
    this.scene.physics.add.existing(hit);
    hit.body.allowGravity = false;
    this.scene.physics.add.overlap(hit, this.scene.enemies, (h, e) => { if (e.destroy) e.destroy(); });
    this.scene.time.delayedCall(150, () => { hit.destroy(); });
  }
}
