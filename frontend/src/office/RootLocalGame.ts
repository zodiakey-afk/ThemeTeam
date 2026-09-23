import Phaser from 'phaser';

// Phaser 3.90's default start installs unowned document/window handlers.
// Keep its loop startup, but give each game removable visibility handlers.
export class RootLocalGame extends Phaser.Game {
  declare isRunning: boolean;

  protected start() {
    this.isRunning = true;
    this.config.postBoot(this);
    this.loop.start(this.renderer ? this.step.bind(this) : this.headlessStep.bind(this));

    const visibility = () => {
      this.events.emit(document.hidden ? Phaser.Core.Events.HIDDEN : Phaser.Core.Events.VISIBLE);
    };
    const blur = () => this.events.emit(Phaser.Core.Events.BLUR);
    const focus = () => this.events.emit(Phaser.Core.Events.FOCUS);
    this.events.on(Phaser.Core.Events.HIDDEN, this.onHidden, this);
    this.events.on(Phaser.Core.Events.VISIBLE, this.onVisible, this);
    this.events.on(Phaser.Core.Events.BLUR, this.onBlur, this);
    this.events.on(Phaser.Core.Events.FOCUS, this.onFocus, this);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur);
    window.addEventListener('focus', focus);
    this.events.once(Phaser.Core.Events.DESTROY, () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur);
      window.removeEventListener('focus', focus);
    });
    if (this.config.autoFocus) window.focus();
  }
}
