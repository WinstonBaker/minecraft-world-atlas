// Multiplayer synchronization for Minecraft World Atlas using Trystero WebRTC (P2P)
// Zero server setup required — works directly on GitHub Pages!

const DEFAULT_ROOM = 'smp';
const APP_ID = 'minecraft-world-atlas-p2p-v1';
const TRYSTERO_URL = 'https://esm.sh/trystero@0.26.0/torrent';

export class MultiplayerManager {
  constructor({ onSync, onAdd, onUpdate, onDelete, onTitle, getState, showToast }) {
    this.onSync = onSync;
    this.onAdd = onAdd;
    this.onUpdate = onUpdate;
    this.onDelete = onDelete;
    this.onTitle = onTitle;
    this.getState = getState;
    this.showToast = showToast;

    this.room = null;
    this.roomId = this.getRoomFromUrl() || DEFAULT_ROOM;
    this.peers = new Map(); // peerId -> { name, color, x, y, lastSeen, isDrawing }
    this.hasSyncedFromPeer = false;

    // Player Profile
    this.playerName = localStorage.getItem('world-atlas-player-name') || `Player_${Math.floor(100 + Math.random() * 900)}`;
    this.playerColor = localStorage.getItem('world-atlas-player-color') || this.randomColor();

    this.actions = {};
    this.connect();
    this.setupCursorCleanup();
  }

  randomColor() {
    const colors = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#9b59b6', '#e84393'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  getRoomFromUrl() {
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash.includes('=') ? hash : `room=${hash}`);
    return params.get('room') || (hash.length > 0 && !hash.includes('=') ? hash : null);
  }

  setRoomInUrl(roomId) {
    window.location.hash = `room=${encodeURIComponent(roomId)}`;
  }

  async connect() {
    this.updateStatusUI('Connecting...', 'connecting');
    try {
      const { joinRoom } = await import(TRYSTERO_URL);
      if (this.room) {
        this.room.leave();
      }

      this.room = joinRoom({ appId: APP_ID }, this.roomId);
      this.setupActions();

      this.room.onPeerJoin(peerId => {
        // Send our current state and announce ourselves
        const state = this.getState();
        this.actions.sendSync?.(state, peerId);
        this.actions.sendProfile?.({ name: this.playerName, color: this.playerColor }, peerId);
        this.showToast(`A player joined room "${this.roomId}"`);
        this.updatePeersUI();
      });

      this.room.onPeerLeave(peerId => {
        const peer = this.peers.get(peerId);
        const name = peer?.name || 'A player';
        this.peers.delete(peerId);
        this.renderRemoteCursors();
        this.updatePeersUI();
        this.showToast(`${name} left the room`);
      });

      this.updateStatusUI(`Room: ${this.roomId}`, 'connected');
      this.updatePeersUI();
    } catch (err) {
      console.warn('P2P multiplayer connection fallback:', err);
      this.updateStatusUI('Solo (Offline)', 'solo');
    }
  }

  setupActions() {
    const [sendSync, getSync] = this.room.makeAction('sync');
    const [sendAdd, getAdd] = this.room.makeAction('add');
    const [sendUpdate, getUpdate] = this.room.makeAction('update');
    const [sendDelete, getDelete] = this.room.makeAction('delete');
    const [sendTitle, getTitle] = this.room.makeAction('title');
    const [sendCursor, getCursor] = this.room.makeAction('cursor');
    const [sendProfile, getProfile] = this.room.makeAction('profile');

    this.actions = { sendSync, sendAdd, sendUpdate, sendDelete, sendTitle, sendCursor, sendProfile };

    getSync((remoteState, peerId) => {
      if (!this.hasSyncedFromPeer) {
        this.hasSyncedFromPeer = true;
        this.onSync(remoteState);
        this.showToast(`Synced map with room "${this.roomId}"`);
      }
    });

    getProfile((profile, peerId) => {
      const existing = this.peers.get(peerId) || {};
      this.peers.set(peerId, { ...existing, ...profile, lastSeen: Date.now() });
      this.updatePeersUI();
    });

    getAdd(feature => {
      this.onAdd(feature);
    });

    getUpdate(feature => {
      this.onUpdate(feature);
    });

    getDelete(featureId => {
      this.onDelete(featureId);
    });

    getTitle(title => {
      this.onTitle(title);
    });

    getCursor((data, peerId) => {
      const existing = this.peers.get(peerId) || {};
      this.peers.set(peerId, {
        ...existing,
        x: data.x,
        y: data.y,
        name: data.name || existing.name || 'Player',
        color: data.color || existing.color || '#3498db',
        isDrawing: !!data.isDrawing,
        lastSeen: Date.now()
      });
      this.renderRemoteCursors();
    });
  }

  switchRoom(newRoomId) {
    if (!newRoomId || newRoomId === this.roomId) return;
    this.roomId = newRoomId.trim();
    this.setRoomInUrl(this.roomId);
    this.peers.clear();
    this.hasSyncedFromPeer = false;
    this.renderRemoteCursors();
    this.connect();
  }

  updateProfile(name, color) {
    if (name) {
      this.playerName = name.trim();
      localStorage.setItem('world-atlas-player-name', this.playerName);
    }
    if (color) {
      this.playerColor = color;
      localStorage.setItem('world-atlas-player-color', this.playerColor);
    }
    this.actions.sendProfile?.({ name: this.playerName, color: this.playerColor });
    this.updatePeersUI();
  }

  broadcastAdd(feature) {
    this.actions.sendAdd?.(feature);
  }

  broadcastUpdate(feature) {
    this.actions.sendUpdate?.(feature);
  }

  broadcastDelete(featureId) {
    this.actions.sendDelete?.(featureId);
  }

  broadcastTitle(title) {
    this.actions.sendTitle?.(title);
  }

  broadcastCursor(worldX, worldY, isDrawing = false) {
    this.actions.sendCursor?.({
      x: Math.round(worldX),
      y: Math.round(worldY),
      name: this.playerName,
      color: this.playerColor,
      isDrawing
    });
  }

  setupCursorCleanup() {
    setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [peerId, peer] of this.peers.entries()) {
        if (now - peer.lastSeen > 8000) {
          this.peers.delete(peerId);
          changed = true;
        }
      }
      if (changed) {
        this.renderRemoteCursors();
        this.updatePeersUI();
      }
    }, 3000);
  }

  renderRemoteCursors() {
    const container = document.getElementById('remote-cursors');
    if (!container) return;

    let svg = '';
    for (const [, peer] of this.peers.entries()) {
      if (peer.x === undefined || peer.y === undefined) continue;
      const label = peer.name || 'Friend';
      const color = peer.color || '#3498db';
      const pencil = peer.isDrawing ? ' ✎' : '';

      svg += `
        <g class="remote-cursor" transform="translate(${peer.x} ${peer.y})" style="pointer-events:none">
          <path d="M0 0 L10 10 L6 11 L9 18 L6.5 19 L3.5 12 L0 15 Z" fill="${color}" stroke="#ffffff" stroke-width="1.2" />
          <g transform="translate(12, 6)">
            <rect x="0" y="0" width="${label.length * 7 + 16}" height="18" rx="4" fill="${color}" opacity="0.9" />
            <text x="6" y="13" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#ffffff">${label}${pencil}</text>
          </g>
        </g>
      `;
    }
    container.innerHTML = svg;
  }

  updateStatusUI(text, statusClass) {
    const statusEl = document.getElementById('room-status-badge');
    const labelEl = document.getElementById('room-name-label');
    if (statusEl) {
      statusEl.className = `status-dot ${statusClass}`;
    }
    if (labelEl) {
      labelEl.textContent = text;
    }
  }

  updatePeersUI() {
    const countEl = document.getElementById('peer-count');
    if (countEl) {
      const count = this.peers.size + 1; // including self
      countEl.textContent = `${count} online`;
    }

    const listEl = document.getElementById('peers-list');
    if (listEl) {
      let html = `<div class="peer-item self"><span class="peer-color" style="background:${this.playerColor}"></span><strong>${this.playerName}</strong> <small>(you)</small></div>`;
      for (const [, peer] of this.peers.entries()) {
        html += `<div class="peer-item"><span class="peer-color" style="background:${peer.color || '#888'}"></span><span>${peer.name || 'Friend'}</span></div>`;
      }
      listEl.innerHTML = html;
    }
  }

  getShareUrl() {
    const url = new URL(window.location.href);
    url.hash = `room=${encodeURIComponent(this.roomId)}`;
    return url.toString();
  }
}
