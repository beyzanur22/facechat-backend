const { io } = require('socket.io-client');

/**
 * Tek bir sahte kullanıcıyı simüle eden bot.
 * Gerçek WebRTC yapmaz; sinyalizasyon el sıkışmasını taklit eder
 * (offerer sahte offer + ICE gönderir, answerer sahte answer döner) —
 * böylece backend'in relay ve eşleştirme akışı uçtan uca test edilir.
 */
class Bot {
  constructor(url, profile) {
    this.url = url;
    this.profile = profile; // { deviceId, gender, region, filterGender, filterRegion }
    this.state = 'idle';
    this.sessionId = null;
    this.isOfferer = false;
    this.stats = { matches: 0, connects: 0, skips: 0, reports: 0, blocks: 0, banned: 0, waiting: 0 };
    this.handlers = {};
  }

  on(event, cb) {
    this.handlers[event] = cb;
    return this;
  }

  _fire(event, data) {
    if (this.handlers[event]) this.handlers[event](data, this);
  }

  connect() {
    this.socket = io(this.url, { forceNew: true, transports: ['websocket'] });

    this.socket.on('connect', () => this._fire('ready'));

    this.socket.on('waiting', () => {
      this.state = 'waiting';
      this.stats.waiting += 1;
      this._fire('waiting');
    });

    this.socket.on('match-found', (m) => {
      this.state = 'matched';
      this.sessionId = m.sessionId;
      this.isOfferer = m.isOfferer;
      this.stats.matches += 1;
      this._fire('match', m);
      if (m.isOfferer) {
        this.socket.emit('offer', { sessionId: m.sessionId, sdp: { type: 'offer', sdp: 'fake-offer' } });
        this.socket.emit('ice-candidate', {
          sessionId: m.sessionId,
          candidate: { sdpMid: '0', sdpMLineIndex: 0, candidate: 'fake-candidate' },
        });
      }
    });

    this.socket.on('offer', ({ sessionId }) => {
      this.socket.emit('answer', { sessionId, sdp: { type: 'answer', sdp: 'fake-answer' } });
      this._markConnected();
    });

    this.socket.on('answer', () => this._markConnected());
    this.socket.on('ice-candidate', () => {});

    this.socket.on('peer-left', (d) => this._resetIdle('peer-left', d));
    this.socket.on('force-disconnect', (d) => this._resetIdle('force-disconnect', d));

    this.socket.on('banned', (d) => {
      this.state = 'banned';
      this.stats.banned += 1;
      this._fire('banned', d);
    });

    this.socket.on('error', (d) => this._fire('server-error', d));
    return this;
  }

  _markConnected() {
    if (this.state !== 'connected') {
      this.state = 'connected';
      this.stats.connects += 1;
      this._fire('connected-peer');
    }
  }

  _resetIdle(event, data) {
    this.state = 'idle';
    this.sessionId = null;
    this._fire(event, data);
  }

  joinQueue() {
    this.state = 'queued';
    this.socket.emit('join-queue', this.profile);
  }

  skip() {
    if (!this.sessionId) return;
    this.socket.emit('skip', { sessionId: this.sessionId });
    this.stats.skips += 1;
    this.state = 'idle';
    this.sessionId = null;
  }

  report(reason = 'inappropriate') {
    if (!this.sessionId) return;
    this.socket.emit('report', { sessionId: this.sessionId, reason });
    this.stats.reports += 1;
  }

  block() {
    if (!this.sessionId) return;
    this.socket.emit('block', { sessionId: this.sessionId });
    this.stats.blocks += 1;
  }

  leave() {
    this.socket.emit('leave', { sessionId: this.sessionId });
  }

  close() {
    this.socket.close();
  }
}

module.exports = Bot;
