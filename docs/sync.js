// Real-time synchronization for Winston's Minecraft World Atlas
// Single shared world across all friends with cloud persistence & live cursors.
// Zero rooms, zero setup.

const STATE_TOPIC = 'winstons-minecraft-world-atlas-v1/state';
const CURSORS_TOPIC = 'winstons-minecraft-world-atlas-v1/cursors';
const BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';

export class SyncManager {
  constructor({ getState, onRemoteState, onRemoteCursor, showToast }) {
    this.getState = getState;
    this.onRemoteState = onRemoteState;
    this.onRemoteCursor = onRemoteCursor;
    this.showToast = showToast;

    this.clientId = 'user_' + Math.random().toString(36).substring(2, 9);
    this.playerName = localStorage.getItem('world-atlas-player-name') || `Friend_${Math.floor(100 + Math.random() * 900)}`;
    this.playerColor = localStorage.getItem('world-atlas-player-color') || this.randomColor();

    this.client = null;
    this.connected = false;
    this.publishTimeout = null;

    this.connect();
  }

  randomColor() {
    const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#e84393'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  connect() {
    this.updateStatus('Connecting...', 'connecting');
    const mqtt = window.mqtt;
    if (!mqtt) {
      console.warn('MQTT library not loaded, falling back to local mode');
      this.updateStatus('Offline (Local)', 'solo');
      return;
    }

    try {
      this.client = mqtt.connect(BROKER_URL, {
        clientId: this.clientId,
        clean: true,
        connectTimeout: 8000,
        reconnectPeriod: 3000
      });

      this.client.on('connect', () => {
        this.connected = true;
        this.updateStatus('🟢 Synced with Friends', 'connected');
        this.client.subscribe([STATE_TOPIC, CURSORS_TOPIC], err => {
          if (err) console.error('Subscription error:', err);
        });
      });

      this.client.on('message', (topic, message) => {
        try {
          const payload = JSON.parse(message.toString());
          if (topic === STATE_TOPIC) {
            // Ignore if this update came from ourselves
            if (payload._senderId === this.clientId) return;
            this.onRemoteState(payload);
          } else if (topic === CURSORS_TOPIC) {
            if (payload.senderId === this.clientId) return;
            this.onRemoteCursor(payload);
          }
        } catch (e) {
          console.warn('Error parsing incoming message:', e);
        }
      });

      this.client.on('offline', () => {
        this.connected = false;
        this.updateStatus('Reconnecting...', 'connecting');
      });

      this.client.on('error', err => {
        console.warn('Sync connection error:', err);
        this.updateStatus('Offline (Local)', 'solo');
      });
    } catch (err) {
      console.warn('MQTT initialization error:', err);
      this.updateStatus('Offline (Local)', 'solo');
    }
  }

  // Publish state with retain: true so friends joining later immediately receive the latest map!
  publishState(state) {
    if (!this.client || !this.connected) return;
    clearTimeout(this.publishTimeout);
    this.publishTimeout = setTimeout(() => {
      const payload = {
        ...state,
        _senderId: this.clientId,
        _updatedAt: Date.now()
      };
      this.client.publish(STATE_TOPIC, JSON.stringify(payload), { retain: true, qos: 1 }, err => {
        if (!err) {
          const statusEl = document.getElementById('save-status');
          if (statusEl) statusEl.textContent = 'Saved to Cloud';
        }
      });
    }, 150);
  }

  // Broadcast cursor movements so friends see each other's pointers in real time
  publishCursor(worldX, worldY, isDrawing = false) {
    if (!this.client || !this.connected) return;
    this.client.publish(CURSORS_TOPIC, JSON.stringify({
      senderId: this.clientId,
      name: this.playerName,
      color: this.playerColor,
      x: Math.round(worldX),
      y: Math.round(worldY),
      isDrawing,
      time: Date.now()
    }), { qos: 0 });
  }

  setPlayerName(name) {
    if (!name) return;
    this.playerName = name.trim();
    localStorage.setItem('world-atlas-player-name', this.playerName);
  }

  setPlayerColor(color) {
    if (!color) return;
    this.playerColor = color;
    localStorage.setItem('world-atlas-player-color', this.playerColor);
  }

  updateStatus(text, statusClass) {
    const badge = document.getElementById('sync-status-badge');
    const label = document.getElementById('sync-status-text');
    if (badge) badge.className = `status-dot ${statusClass}`;
    if (label) label.textContent = text;
  }
}
