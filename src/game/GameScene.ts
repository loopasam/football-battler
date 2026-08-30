import Phaser from 'phaser';
import {
  createTeamGraph,
  planPassingRoute,
  type TeamGraph,
} from './graph';
import {
  AWAY_TEAM,
  BUILD_UP_TARGET,
  HOME_TEAM,
  completePass,
  createMatch,
  getWinner,
  resolveShot,
  startAttack,
  type MatchState,
  type PlayerDefinition,
  type PlayerLane,
  type PlayerLayer,
  type Side,
  type TeamDefinition,
} from './model';

const COLORS = {
  background: 0xf8f7f2,
  pitch: 0xeff4ed,
  pitchAlt: 0xe5ede3,
  line: 0x879c90,
  faintLine: 0xc8d4cd,
  paper: 0x18211d,
  muted: 0x66776e,
  ink: 0xffffff,
  home: 0x177a52,
  away: 0xc45b27,
  node: 0xffffff,
  ball: 0xf1c644,
  danger: 0xd44b4b,
  button: 0x18211d,
};

const TEXT_RESOLUTION = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);

interface Point {
  x: number;
  y: number;
}

const LANE_X: Record<PlayerLane, number> = {
  'far-left': 70,
  left: 145,
  'inside-left': 220,
  center: 300,
  'inside-right': 380,
  right: 455,
  'far-right': 530,
};

const LAYER_Y: Record<Side, Record<PlayerLayer, number>> = {
  away: { goalkeeper: 201, defense: 284, midfield: 366, attack: 449 },
  home: { goalkeeper: 779, defense: 696, midfield: 614, attack: 531 },
};

const TEAM_GRAPHS: Record<Side, TeamGraph> = {
  home: createTeamGraph(HOME_TEAM),
  away: createTeamGraph(AWAY_TEAM),
};

const ROUTES: Record<Side, string[]> = {
  home: planPassingRoute(TEAM_GRAPHS.home, BUILD_UP_TARGET),
  away: planPassingRoute(TEAM_GRAPHS.away, BUILD_UP_TARGET),
};

const NODE_POSITIONS = new Map<string, Point>();
[HOME_TEAM, AWAY_TEAM].forEach((team, index) => {
  const side: Side = index === 0 ? 'home' : 'away';
  team.players.forEach((player) => {
    NODE_POSITIONS.set(player.id, {
      x: LANE_X[player.lane],
      y: LAYER_Y[side][player.layer],
    });
  });
});

export class GameScene extends Phaser.Scene {
  private match: MatchState = createMatch();
  private locked = false;
  private ball!: Phaser.GameObjects.Arc;
  private scoreText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private homeDefenseText!: Phaser.GameObjects.Text;
  private awayDefenseText!: Phaser.GameObjects.Text;
  private homeDefenseFill!: Phaser.GameObjects.Rectangle;
  private awayDefenseFill!: Phaser.GameObjects.Rectangle;
  private actionText!: Phaser.GameObjects.Text;
  private eventText!: Phaser.GameObjects.Text;
  private buttonText!: Phaser.GameObjects.Text;
  private buttonBackground!: Phaser.GameObjects.Rectangle;
  private pathTrail!: Phaser.GameObjects.Graphics;
  private buildPips: Phaser.GameObjects.Rectangle[] = [];
  private nodeBodies = new Map<string, Phaser.GameObjects.Arc>();

  constructor() {
    super('match');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.cameras.main.setZoom(2);
    this.cameras.main.centerOn(300, 500);
    this.drawHeader();
    this.drawPitch();
    this.pathTrail = this.add.graphics().setDepth(4);
    this.drawTeamGraph(HOME_TEAM, 'home');
    this.drawTeamGraph(AWAY_TEAM, 'away');
    this.createBall();
    this.createActionButton();
    this.updatePresentation('HOME ATTACK READY');

    this.input.keyboard?.on('keydown-SPACE', () => this.handlePrimaryAction());
    this.input.keyboard?.on('keydown-ENTER', () => this.handlePrimaryAction());
  }

  private drawHeader(): void {
    this.addText(20, 16, 'HOME', 17, COLORS.home);
    this.addText(580, 16, 'AWAY', 17, COLORS.away).setOrigin(1, 0);

    this.addText(20, 44, 'TEAM DEFENSE', 10, COLORS.muted);
    this.addText(580, 44, 'TEAM DEFENSE', 10, COLORS.muted).setOrigin(1, 0);

    this.add.rectangle(95, 72, 150, 11, COLORS.faintLine).setOrigin(0.5);
    this.add.rectangle(505, 72, 150, 11, COLORS.faintLine).setOrigin(0.5);
    this.homeDefenseFill = this.add.rectangle(20, 72, 150, 11, COLORS.home).setOrigin(0, 0.5);
    this.awayDefenseFill = this.add.rectangle(430, 72, 150, 11, COLORS.away).setOrigin(0, 0.5);
    this.homeDefenseText = this.addText(20, 86, '', 11, COLORS.paper);
    this.awayDefenseText = this.addText(580, 86, '', 11, COLORS.paper).setOrigin(1, 0);

    this.scoreText = this.addText(300, 22, '0 — 0', 31, COLORS.paper).setOrigin(0.5, 0);
    this.roundText = this.addText(300, 65, 'ROUND 1 / 5', 12, COLORS.muted).setOrigin(0.5, 0);

    const pipStartX = 248;
    for (let index = 0; index < BUILD_UP_TARGET; index += 1) {
      const pip = this.add.rectangle(pipStartX + index * 34, 112, 24, 9, COLORS.faintLine);
      this.buildPips.push(pip);
    }
    this.addText(225, 105, 'BUILD', 10, COLORS.muted).setOrigin(1, 0);
    this.addText(382, 103, '→ SHOT', 12, COLORS.muted);
    this.actionText = this.addText(300, 132, '', 12, COLORS.paper).setOrigin(0.5, 0);
  }

  private drawPitch(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(COLORS.pitch, 1);
    graphics.fillRect(20, 160, 560, 660);

    const zoneHeight = 82.5;
    for (let zone = 0; zone < 8; zone += 1) {
      if (zone % 2 === 0) {
        graphics.fillStyle(COLORS.pitchAlt, 0.72);
        graphics.fillRect(20, 160 + zone * zoneHeight, 560, zoneHeight);
      }
    }

    graphics.lineStyle(2, COLORS.line, 0.9);
    graphics.strokeRect(20, 160, 560, 660);
    graphics.lineBetween(20, 490, 580, 490);
    graphics.strokeCircle(300, 490, 54);
    graphics.lineStyle(1, COLORS.faintLine, 0.95);
    for (let zone = 1; zone < 8; zone += 1) {
      graphics.lineBetween(20, 160 + zone * zoneHeight, 580, 160 + zone * zoneHeight);
    }

    graphics.lineStyle(3, COLORS.paper, 0.72);
    graphics.strokeRect(220, 144, 160, 16);
    graphics.strokeRect(220, 820, 160, 16);

    this.eventText = this.addText(300, 868, '', 16, COLORS.paper).setOrigin(0.5, 0);
  }

  private drawTeamGraph(team: TeamDefinition, side: Side): void {
    const color = side === 'home' ? COLORS.home : COLORS.away;
    const edgeGraphics = this.add.graphics().setDepth(1);
    TEAM_GRAPHS[side].edges.forEach((edge) => {
      const from = this.nodePosition(edge.from);
      const to = this.nodePosition(edge.to);
      edgeGraphics.lineStyle(edge.kind === 'lateral' ? 2 : 3, color, edge.kind === 'lateral' ? 0.28 : 0.38);
      edgeGraphics.lineBetween(from.x, from.y, to.x, to.y);
    });

    team.players.forEach((player) => this.drawNode(player, color));
  }

  private drawNode(player: PlayerDefinition, color: number): void {
    const position = this.nodePosition(player.id);
    const container = this.add.container(position.x, position.y).setDepth(10);
    const body = this.add.circle(0, 0, 30, COLORS.node).setStrokeStyle(3, color, 0.82);
    const divider = this.add.rectangle(0, 0, 38, 1, color, 0.2);

    container.add([
      body,
      divider,
      this.addText(0, -19, `A ${player.attack}`, 11, color).setOrigin(0.5, 0),
      this.addText(0, 5, `D ${player.defense}`, 11, COLORS.paper).setOrigin(0.5, 0),
    ]);
    this.nodeBodies.set(player.id, body);
  }

  private createBall(): void {
    const start = this.nodePosition(ROUTES.home[0]);
    this.ball = this.add.circle(start.x, start.y, 6, COLORS.ball)
      .setStrokeStyle(2, COLORS.paper)
      .setDepth(20);
  }

  private createActionButton(): void {
    this.buttonBackground = this.add.rectangle(300, 950, 390, 70, COLORS.button)
      .setStrokeStyle(2, COLORS.ink)
      .setInteractive({ useHandCursor: true });
    this.buttonText = this.addText(300, 950, '', 18, COLORS.ink).setOrigin(0.5);

    this.buttonBackground.on('pointerover', () => {
      if (!this.locked) this.buttonBackground.setFillStyle(COLORS.home);
    });
    this.buttonBackground.on('pointerout', () => {
      this.buttonBackground.setFillStyle(COLORS.button);
    });
    this.buttonBackground.on('pointerdown', () => this.handlePrimaryAction());
  }

  private handlePrimaryAction(): void {
    if (this.locked) return;
    if (this.match.phase === 'finished') {
      this.restartMatch();
    }
    this.playAttack();
  }

  private playAttack(): void {
    this.locked = true;
    this.buttonBackground.disableInteractive().setAlpha(0.42);
    this.buttonText.setText('MATCH IN PROGRESS');
    this.match = startAttack(this.match);
    this.eventText.setText('POSSESSION STARTED').setColor(this.toCss(this.sideColor(this.match.attacking)));
    this.updatePresentation();
    this.announce(`${this.sideLabel(this.match.attacking)} possession started.`);

    const route = ROUTES[this.match.attacking];
    const start = this.nodePosition(route[0]);
    this.pathTrail.clear();
    this.ball.setPosition(start.x, start.y).setVisible(true);
    this.highlightNode(route[0]);
    this.time.delayedCall(260, () => this.animatePass(route, 1));
  }

  private animatePass(route: string[], routeIndex: number): void {
    if (routeIndex >= route.length) {
      this.animateShot(route[route.length - 1]);
      return;
    }

    const targetId = route[routeIndex];
    const target = this.nodePosition(targetId);
    this.pathTrail.lineStyle(5, this.sideColor(this.match.attacking), 0.62);
    this.pathTrail.lineBetween(this.ball.x, this.ball.y, target.x, target.y);
    this.eventText.setText(`PASS ${routeIndex} / ${BUILD_UP_TARGET}`);

    this.tweens.add({
      targets: this.ball,
      x: target.x,
      y: target.y,
      duration: 400,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.match = completePass(this.match);
        this.highlightNode(targetId);
        this.updatePresentation();
        this.announce(`Pass ${routeIndex} completed. Build-Up ${this.match.buildUp} of ${BUILD_UP_TARGET}.`);
        this.time.delayedCall(140, () => this.animatePass(route, routeIndex + 1));
      },
    });
  }

  private animateShot(shooterId: string): void {
    const attackingSide = this.match.attacking;
    const team = this.teamFor(attackingSide);
    const shooter = team.players.find((player) => player.id === shooterId);
    if (!shooter) throw new Error(`Missing shooter node: ${shooterId}`);

    const goal = attackingSide === 'home' ? { x: 300, y: 144 } : { x: 300, y: 836 };
    const line = this.add.graphics().setDepth(5);
    line.lineStyle(4, COLORS.ball, 0.72);
    line.lineBetween(this.ball.x, this.ball.y, goal.x, goal.y);
    this.eventText.setText(`SHOT • ATTACK ${shooter.attack}`);
    this.actionText.setText('CHANCE CREATED • SHOT RELEASED').setColor(this.toCss(COLORS.ball));
    this.announce(`${this.sideLabel(attackingSide)} shoots with Attack ${shooter.attack}.`);

    this.tweens.add({
      targets: this.ball,
      x: goal.x,
      y: goal.y,
      scale: 1.65,
      duration: 520,
      ease: 'Quad.easeIn',
      onComplete: () => {
        line.destroy();
        this.ball.setScale(1);
        const defendingSide: Side = attackingSide === 'home' ? 'away' : 'home';
        this.match = resolveShot(this.match, shooter.attack);
        const shot = this.match.lastShot;
        if (!shot) throw new Error('Shot resolution was not recorded.');

        if (shot.goal) {
          this.updatePresentation(`GOAL • ${this.sideLabel(attackingSide)} +1`, {
            side: defendingSide,
            defense: 0,
          });
          this.eventText.setColor(this.toCss(this.sideColor(attackingSide)));
          this.cameras.main.flash(260, 233, 241, 230, false);
          this.announce(`Goal for ${this.sideLabel(attackingSide)}. The score is ${this.match.home.score} to ${this.match.away.score}.`);
        } else {
          this.updatePresentation(
            `SHOT ${shooter.attack} • ${this.sideLabel(defendingSide)} DEFENSE ${shot.defenseAfter} / ${this.match[defendingSide].maxDefense}`,
          );
          this.announce(`${this.sideLabel(defendingSide)} Defense reduced to ${shot.defenseAfter}.`);
        }

        this.time.delayedCall(800, () => this.finishAttack());
      },
    });
  }

  private finishAttack(): void {
    if (this.match.phase === 'finished') {
      const winner = getWinner(this.match);
      const result = winner === 'draw' ? 'FULL TIME • DRAW' : `FULL TIME • ${this.sideLabel(winner ?? 'home')} WINS`;
      this.updatePresentation(result);
      this.eventText.setColor(this.toCss(COLORS.paper));
      this.buttonText.setText('PLAY AGAIN');
      this.buttonBackground.setAlpha(1).setInteractive({ useHandCursor: true });
      this.locked = false;
      this.announce(`Full time. Final score Home ${this.match.home.score}, Away ${this.match.away.score}. ${result}.`);
      return;
    }

    const nextStart = this.nodePosition(ROUTES[this.match.attacking][0]);
    this.ball.setPosition(nextStart.x, nextStart.y);
    this.highlightNode(ROUTES[this.match.attacking][0]);
    this.updatePresentation(`${this.sideLabel(this.match.attacking)} POSSESSION`);
    this.buttonText.setText('MATCH IN PROGRESS');
    this.announce(`${this.sideLabel(this.match.attacking)} prepares the next possession.`);
    this.time.delayedCall(500, () => this.playAttack());
  }

  private restartMatch(): void {
    this.tweens.killAll();
    this.match = createMatch();
    const start = this.nodePosition(ROUTES.home[0]);
    this.pathTrail.clear();
    this.ball.setPosition(start.x, start.y).setScale(1).setVisible(true);
    this.highlightNode(ROUTES.home[0]);
    this.eventText.setColor(this.toCss(COLORS.home));
    this.updatePresentation('HOME ATTACK READY');
    this.announce('New five-round match. Home attacks first.');
  }

  private updatePresentation(
    event?: string,
    defenseOverride?: { side: Side; defense: number },
  ): void {
    const homeDefense = defenseOverride?.side === 'home' ? defenseOverride.defense : this.match.home.defense;
    const awayDefense = defenseOverride?.side === 'away' ? defenseOverride.defense : this.match.away.defense;
    const homeRatio = homeDefense / this.match.home.maxDefense;
    const awayRatio = awayDefense / this.match.away.maxDefense;

    this.homeDefenseFill.width = 150 * homeRatio;
    this.awayDefenseFill.width = 150 * awayRatio;
    this.homeDefenseFill.setFillStyle(homeRatio <= 0.25 ? COLORS.danger : COLORS.home);
    this.awayDefenseFill.setFillStyle(awayRatio <= 0.25 ? COLORS.danger : COLORS.away);
    this.homeDefenseText.setText(`${homeDefense} / ${this.match.home.maxDefense}`);
    this.awayDefenseText.setText(`${awayDefense} / ${this.match.away.maxDefense}`);
    this.scoreText.setText(`${this.match.home.score} — ${this.match.away.score}`);
    this.roundText.setText(`ROUND ${this.match.round} / 5`);

    this.buildPips.forEach((pip, index) => {
      pip.setFillStyle(index < this.match.buildUp ? this.sideColor(this.match.attacking) : COLORS.faintLine);
    });

    if (this.match.phase === 'ready') {
      this.actionText
        .setText(`${this.sideLabel(this.match.attacking)} POSSESSION • BUILD-UP 0 / ${BUILD_UP_TARGET}`)
        .setColor(this.toCss(this.sideColor(this.match.attacking)));
      this.buttonText.setText('PLAY GAME');
    } else if (this.match.phase === 'passing') {
      this.actionText
        .setText(`${this.sideLabel(this.match.attacking)} PASSING • BUILD-UP ${this.match.buildUp} / ${BUILD_UP_TARGET}`)
        .setColor(this.toCss(this.sideColor(this.match.attacking)));
    } else if (this.match.phase === 'finished') {
      this.actionText.setText('FIVE ROUNDS COMPLETE').setColor(this.toCss(COLORS.paper));
    }

    if (event) this.eventText.setText(event);
  }

  private highlightNode(nodeId: string): void {
    this.nodeBodies.forEach((body, id) => {
      const side: Side = id.startsWith('home') ? 'home' : 'away';
      if (id === nodeId) {
        body.setStrokeStyle(4, COLORS.ball, 1);
      } else {
        body.setStrokeStyle(3, this.sideColor(side), 0.82);
      }
    });
  }

  private nodePosition(playerId: string): Point {
    const position = NODE_POSITIONS.get(playerId);
    if (!position) throw new Error(`Missing graph position for ${playerId}.`);
    return position;
  }

  private teamFor(side: Side): TeamDefinition {
    return side === 'home' ? HOME_TEAM : AWAY_TEAM;
  }

  private sideColor(side: Side): number {
    return side === 'home' ? COLORS.home : COLORS.away;
  }

  private sideLabel(side: Side): string {
    return side === 'home' ? 'HOME' : 'AWAY';
  }

  private addText(x: number, y: number, text: string, size: number, color: number): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, {
      color: this.toCss(color),
      fontFamily: 'Courier New, monospace',
      fontSize: `${size}px`,
      fontStyle: 'bold',
      resolution: TEXT_RESOLUTION,
    });
  }

  private toCss(color: number): string {
    return `#${color.toString(16).padStart(6, '0')}`;
  }

  private announce(message: string): void {
    const status = document.querySelector<HTMLElement>('#game-status');
    if (status) status.textContent = message;
  }
}
