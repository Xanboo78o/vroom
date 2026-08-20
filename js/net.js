/* =============================================================================
   net.js — Supabase Realtime rooms, same recipe as the shooter (proven live).
   Who owns what:
     · YOU own your own guy + any machine you're driving (or built, if parked).
     · Impacts/shears are decided by the client simulating that machine.
   Friends-only netcode. It trusts everybody. That's fine.
   ============================================================================= */

const SUPA_URL = 'https://wsjrcoibrigewmwospva.supabase.co';
const SUPA_KEY = 'sb_publishable_n88dYo7wUYb_utwKiQT3uQ_HGOtXDZb';

const EVENTS = ['g', 'm', 'build', 'shear', 'grab', 'seat', 'lap', 'cfg', 'hi', 'vo', 'va', 'vi'];

export const NET = {
  me: 'p' + Math.random().toString(36).slice(2, 8),
  name: '', code: '', isHost: false, online: false,
  peers: new Map(),
  ch: null, client: null,
  _h: {},

  on(type, fn){ (this._h[type] ||= []).push(fn); return this; },
  fire(type, data, from){ (this._h[type] || []).forEach(fn => fn(data, from)); },

  send(type, data){
    if(!this.ch || !this.online) return;
    this.ch.send({ type: 'broadcast', event: type, payload: { d: data, f: this.me } });
  },

  async join(code, name, asHost){
    this.code = code.toUpperCase(); this.name = name; this.isHost = !!asHost;
    // eventsPerSecond MUST be raised — the default 10/s silently lags state sync
    this.client = supabase.createClient(SUPA_URL, SUPA_KEY, {
      realtime: { params: { eventsPerSecond: 40 } }
    });
    this.ch = this.client.channel('vr:' + this.code, {
      config: { broadcast: { self: false }, presence: { key: this.me } }
    });
    for(const ev of EVENTS){
      this.ch.on('broadcast', { event: ev }, msg => {
        const p = msg.payload || {};
        if(p.f === this.me) return;
        this.fire(ev, p.d, p.f);
      });
    }
    this.ch.on('presence', { event: 'sync' }, () => {
      const st = this.ch.presenceState();
      this.peers.clear();
      for(const key of Object.keys(st)){
        const m = st[key][0] || {};
        this.peers.set(key, { name: m.name || '???', host: !!m.host });
      }
      this.fire('peers', this.peers);
    });
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('timed out')), 9000);
      this.ch.subscribe(async status => {
        if(status === 'SUBSCRIBED'){
          clearTimeout(t);
          this.online = true;
          await this.ch.track({ name: this.name, host: this.isHost });
          res(true);
        } else if(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'){
          clearTimeout(t); rej(new Error(status));
        }
      });
    });
  },

  leave(){
    if(this.ch) this.ch.unsubscribe();
    this.online = false; this.peers.clear();
  }
};

export function makeCode(){
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // no I or O, they read as 1 and 0
  return Array.from({ length: 4 }, () => L[(Math.random() * L.length) | 0]).join('');
}
