/* =============================================================================
   voice.js — minimal WebRTC voice mesh over the room channel.
   Simplified from Foglast's ProxyChat: NO adaptive gate (that whole bug class),
   just an open mic with a mute button. Deterministic initiator: lower id calls.
   Signals ride NET events vo (offer) / va (answer) / vi (ICE), targeted by t.
   ============================================================================= */

export const VOICE = {
  net: null, stream: null, pcs: new Map(), audios: new Map(),
  muted: false, on: false, status: 'off',

  async start(net){
    this.net = net;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });
    } catch(e){ this.status = 'mic blocked'; return false; }
    this.on = true; this.status = 'on';

    net.on('vo', async (d) => { if(d.t === net.me) await this._onOffer(d); });
    net.on('va', async (d) => {
      if(d.t !== net.me) return;
      const pc = this.pcs.get(d.f0);
      if(pc) await pc.setRemoteDescription(d.sdp).catch(() => {});
    });
    net.on('vi', async (d) => {
      if(d.t !== net.me) return;
      const pc = this.pcs.get(d.f0);
      if(pc && d.cand) await pc.addIceCandidate(d.cand).catch(() => {});
    });
    net.on('peers', () => this._sweep());
    this._sweep();
    return true;
  },

  _pc(peerId){
    if(this.pcs.has(peerId)) return this.pcs.get(peerId);
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    this.pcs.set(peerId, pc);
    for(const tr of this.stream.getTracks()) pc.addTrack(tr, this.stream);
    pc.onicecandidate = e => {
      if(e.candidate) this.net.send('vi', { t: peerId, f0: this.net.me, cand: e.candidate.toJSON() });
    };
    pc.ontrack = e => {
      let a = this.audios.get(peerId);
      if(!a){ a = new Audio(); a.autoplay = true; this.audios.set(peerId, a); }
      a.srcObject = e.streams[0];
      a.play().catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      if(pc.connectionState === 'failed' || pc.connectionState === 'closed') this._drop(peerId);
    };
    return pc;
  },

  _sweep(){
    if(!this.on) return;
    for(const id of this.net.peers.keys()){
      if(id === this.net.me) continue;
      if(this.net.me < id && !this.pcs.has(id)) this._call(id);   // lower id initiates
    }
    for(const id of [...this.pcs.keys()])
      if(!this.net.peers.has(id)) this._drop(id);
  },

  async _call(peerId){
    const pc = this._pc(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.net.send('vo', { t: peerId, f0: this.net.me, sdp: pc.localDescription.toJSON() });
  },

  async _onOffer(d){
    const pc = this._pc(d.f0);
    await pc.setRemoteDescription(d.sdp).catch(() => {});
    const ans = await pc.createAnswer();
    await pc.setLocalDescription(ans);
    this.net.send('va', { t: d.f0, f0: this.net.me, sdp: pc.localDescription.toJSON() });
  },

  _drop(peerId){
    const pc = this.pcs.get(peerId);
    if(pc) pc.close();
    this.pcs.delete(peerId);
    const a = this.audios.get(peerId);
    if(a){ a.srcObject = null; }
    this.audios.delete(peerId);
  },

  toggleMute(){
    this.muted = !this.muted;
    if(this.stream) for(const tr of this.stream.getAudioTracks()) tr.enabled = !this.muted;
    return this.muted;
  },

  stop(){
    for(const id of [...this.pcs.keys()]) this._drop(id);
    if(this.stream) for(const tr of this.stream.getTracks()) tr.stop();
    this.stream = null; this.on = false; this.status = 'off';
  }
};
