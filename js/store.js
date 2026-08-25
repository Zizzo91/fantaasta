const Store = {
  _prefix: 'fantaasta_',

  _get(key) {
    try {
      const raw = localStorage.getItem(this._prefix + key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  _set(key, value) {
    localStorage.setItem(this._prefix + key, JSON.stringify(value));
  },

  _remove(key) {
    localStorage.removeItem(this._prefix + key);
  },

  saveConfig(config) { this._set('config', config); },
  getConfig() { return this._get('config'); },

  savePlayers(players) { this._set('players', players); },
  getPlayers() { return this._get('players') || []; },

  saveParticipants(participants) { this._set('participants', participants); },
  getParticipants() { return this._get('participants') || []; },

  saveWishlist(wishlist) { this._set('wishlist', wishlist); },
  getWishlist() { return this._get('wishlist') || []; },

  saveDashboardOrder(order) { this._set('dashboard_order', order); },
  getDashboardOrder() { return this._get('dashboard_order'); },

  saveSpendingExpanded(val) { this._set('spending_expanded', val); },
  getSpendingExpanded() { return this._get('spending_expanded') || false; },

  saveRosterExpanded(val) { this._set('roster_expanded', val); },
  getRosterExpanded() { return this._get('roster_expanded') || false; },

  saveTeams(teams) { this._set('teams', teams); },
  getTeams() { return this._get('teams') || {}; },

  saveAuctionLog(log) { this._set('auction_log', log); },
  getAuctionLog() { return this._get('auction_log') || []; },

  saveApiKey(key) { this._set('api_key', key); },
  getApiKey() { return this._get('api_key') || ''; },

  savePreAstaPlan(plan) { this._set('preasta_plan', plan); },
  getPreAstaPlan() { return this._get('preasta_plan'); },

  saveBudgetPlanner(data) { this._set('budget_planner', data); },
  getBudgetPlanner() { return this._get('budget_planner') || { P: 30, D: 25, C: 25, A: 20 }; },

  getAiCache() { return this._get('ai_cache') || {}; },
  saveAiCache(cache) { this._set('ai_cache', cache); },

  cacheGet(type, key) {
    const cache = this.getAiCache();
    const entry = cache[type + ':' + key];
    if (!entry) return null;
    if (entry.ttl && Date.now() - entry.ts > entry.ttl) {
      delete cache[type + ':' + key];
      this.saveAiCache(cache);
      return null;
    }
    return entry.data;
  },

  cacheSet(type, key, data, ttl) {
    const cache = this.getAiCache();
    cache[type + ':' + key] = { data, ts: Date.now(), ttl: ttl || 0 };
    this.saveAiCache(cache);
  },

  cacheClear(type, key) {
    const cache = this.getAiCache();
    if (key) {
      delete cache[type + ':' + key];
    } else {
      Object.keys(cache).forEach(k => {
        if (k.startsWith(type + ':')) delete cache[k];
      });
    }
    this.saveAiCache(cache);
  },

  initTeamsFromParticipants(participants, config) {
    const teams = {};
    participants.forEach(p => {
      teams[p.name] = {
        credits: p.credits,
        roster: { P: [], D: [], C: [], A: [] }
      };
    });
    this.saveTeams(teams);
    return teams;
  },

  recordSale(player, buyer, price) {
    const teams = this.getTeams();
    if (teams[buyer]) {
      teams[buyer].credits -= price;
      const mainRole = player.R || player.role;
      if (teams[buyer].roster[mainRole]) {
        teams[buyer].roster[mainRole].push({
          id: player.Id || player.id,
          name: player.Nome || player.name,
          role: mainRole,
          team: player.Squadra || player.team,
          price: price
        });
      }
      this.saveTeams(teams);
    }

    const log = this.getAuctionLog();
    log.push({
      num: log.length + 1,
      player: player.Nome || player.name,
      role: player.R || player.role,
      team: player.Squadra || player.team,
      buyer: buyer,
      price: price,
      timestamp: Date.now()
    });
    this.saveAuctionLog(log);
    this.cacheClear('bid', player.Nome || player.name);
    return { teams, log };
  },

  recordUnassigned(player) {
    const log = this.getAuctionLog();
    log.push({
      num: log.length + 1,
      player: player.Nome || player.name,
      role: player.R || player.role,
      team: player.Squadra || player.team,
      buyer: null,
      price: 0,
      timestamp: Date.now()
    });
    this.saveAuctionLog(log);
    this.cacheClear('bid', player.Nome || player.name);
    return log;
  },

  removePlayerFromRoster(playerName, ownerName) {
    const teams = this.getTeams();
    const team = teams[ownerName];
    if (!team) return { success: false, error: 'Squadra non trovata' };

    let removedRole = null;
    let refunded = 0;
    for (const r of ['P', 'D', 'C', 'A']) {
      if (!team.roster[r]) continue;
      const idx = team.roster[r].findLastIndex(p => p.name === playerName);
      if (idx >= 0) {
        const entry = team.roster[r].splice(idx, 1)[0];
        refunded = entry.price;
        removedRole = r;
        break;
      }
    }
    if (!removedRole) return { success: false, error: 'Giocatore non trovato nella rosa' };

    team.credits += refunded;
    this.saveTeams(teams);

    const log = this.getAuctionLog();
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i];
      if (e.player === playerName && e.buyer === ownerName) {
        log.splice(i, 1);
        break;
      }
    }
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i];
      if (e.player === playerName && e.buyer === null) {
        log.splice(i, 1);
        break;
      }
    }
    for (let i = 0; i < log.length; i++) {
      log[i].num = i + 1;
    }
    this.saveAuctionLog(log);

    this.cacheClear('bid', playerName);
    if (removedRole) this.cacheClear('call', removedRole);

    return { success: true, refunded, role: removedRole };
  },

  getAuctionedPlayerIds() {
    const log = this.getAuctionLog();
    return new Set(log.map(e => e.player));
  },

  getRemainingPlayers() {
    const players = this.getPlayers();
    const auctioned = this.getAuctionedPlayerIds();
    return players.filter(p => !auctioned.has(p.Nome));
  },

  getPlayerByName(name) {
    const players = this.getPlayers();
    const lower = name.toLowerCase();
    return players.find(p => p.Nome.toLowerCase().includes(lower));
  },

  searchPlayers(query) {
    const players = this.getPlayers();
    const lower = query.toLowerCase().trim();
    if (!lower) return [];
    const auctioned = this.getAuctionedPlayerIds();
    return players
      .filter(p => p.Nome.toLowerCase().includes(lower) && !auctioned.has(p.Nome))
      .slice(0, 15);
  },

  getConfiguredRoles() {
    const config = this.getConfig();
    if (!config) return { P: 0, D: 0, C: 0, A: 0 };
    return {
      P: parseInt(config.rosterP) || 0,
      D: parseInt(config.rosterD) || 0,
      C: parseInt(config.rosterC) || 0,
      A: parseInt(config.rosterA) || 0
    };
  },

  getMarketRemaining() {
    const players = this.getPlayers();
    const auctioned = this.getAuctionedPlayerIds();
    const remaining = players.filter(p => !auctioned.has(p.Nome));
    const count = { P: 0, D: 0, C: 0, A: 0 };
    remaining.forEach(p => {
      const r = p.R;
      if (count[r] !== undefined) count[r]++;
    });
    return count;
  },

  exportAll() {
    const data = {};
    const keys = ['config', 'players', 'participants', 'wishlist', 'teams', 'auction_log', 'api_key', 'dashboard_order', 'spending_expanded', 'roster_expanded', 'preasta_plan', 'budget_planner'];
    keys.forEach(k => { data[k] = this._get(k); });
    return JSON.stringify(data, null, 2);
  },

  importAll(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      Object.keys(data).forEach(k => {
        if (data[k] !== null && data[k] !== undefined) {
          this._set(k, data[k]);
        }
      });
      return true;
    } catch { return false; }
  },

  clearAll() {
    const keys = ['config', 'players', 'participants', 'wishlist', 'teams', 'auction_log', 'ai_cache', 'dashboard_order', 'spending_expanded', 'roster_expanded', 'preasta_plan', 'budget_planner'];
    keys.forEach(k => this._remove(k));
  },

  clearAllIncludingApiKey() {
    const keys = ['config', 'players', 'participants', 'wishlist', 'teams', 'auction_log', 'api_key'];
    keys.forEach(k => this._remove(k));
  }
};
