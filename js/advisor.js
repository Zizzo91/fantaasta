const Advisor = {
  isConfigured() {
    return !!Store.getApiKey();
  },

  async callGemini(systemPrompt, userPrompt, maxTokens) {
    const apiKey = (Store.getApiKey() || '').trim();
    if (!apiKey) throw new Error('API key non configurata. Vai alla tab Impostazioni.');

    const model = 'gemini-3.6-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      contents: [
        { role: 'user', parts: [{ text: userPrompt }] }
      ],
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: maxTokens || 1024
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error ${response.status}: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  },

  buildBidContext(player) {
    const config = Store.getConfig();
    const participants = Store.getParticipants();
    const teams = Store.getTeams();
    const roles = Store.getConfiguredRoles();
    const wishlist = Store.getWishlist();
    const currentBid = parseInt(document.getElementById('current-bid-price').value) || player.QtA;
    const meName = config ? config.myName : (participants[0]?.name || '');

    const meTeam = teams[meName] || { credits: config.credits, roster: { P: [], D: [], C: [], A: [] } };

    const meCtx = {
      budget: meTeam.credits,
      slots_left: {},
      bought: {}
    };
    ['P', 'D', 'C', 'A'].forEach(r => {
      meCtx.bought[r] = meTeam.roster[r] ? meTeam.roster[r].length : 0;
      meCtx.slots_left[r] = (roles[r] || 0) - meCtx.bought[r];
    });

    const opponents = participants
      .filter(p => p.name !== meName)
      .map(p => {
        const t = teams[p.name] || { credits: config.credits, roster: { P: [], D: [], C: [], A: [] } };
        const ctx = { name: p.name, budget: t.credits, slots_left: {}, bought: {} };
        ['P', 'D', 'C', 'A'].forEach(r => {
          ctx.bought[r] = t.roster[r] ? t.roster[r].length : 0;
          ctx.slots_left[r] = (roles[r] || 0) - ctx.bought[r];
        });
        return ctx;
      });

    const isInWishlist = wishlist.some(w =>
      player.Nome.toLowerCase().includes(w.name.toLowerCase())
    );

    return {
      player: { name: player.Nome, role: player.R, team: player.Squadra, base_value: player.QtA },
      me: meCtx,
      opponents,
      current_bid: currentBid,
      min_increment: config.minBid || 1,
      is_in_my_wishlist: isInWishlist
    };
  },

  buildCallContext(callRole) {
    const config = Store.getConfig();
    const participants = Store.getParticipants();
    const teams = Store.getTeams();
    const roles = Store.getConfiguredRoles();
    const wishlist = Store.getWishlist();

    const meName = config ? config.myName : (participants[0]?.name || '');
    const meTeam = teams[meName] || { credits: config.credits, roster: { P: [], D: [], C: [], A: [] } };

    const meCtx = { budget: meTeam.credits, slots_left: {}, bought: {} };
    ['P', 'D', 'C', 'A'].forEach(r => {
      meCtx.bought[r] = meTeam.roster[r] ? meTeam.roster[r].length : 0;
      meCtx.slots_left[r] = (roles[r] || 0) - meCtx.bought[r];
    });

    const opponents = participants
      .filter(p => p.name !== meName)
      .map(p => {
        const t = teams[p.name] || { credits: config.credits, roster: { P: [], D: [], C: [], A: [] } };
        const ctx = { name: p.name, budget: t.credits, slots_left: {}, bought: {} };
        ['P', 'D', 'C', 'A'].forEach(r => {
          ctx.bought[r] = t.roster[r] ? t.roster[r].length : 0;
          ctx.slots_left[r] = (roles[r] || 0) - ctx.bought[r];
        });
        return ctx;
      });

    const remaining = Store.getRemainingPlayers();
    const marketRemaining = { P: 0, D: 0, C: 0, A: 0 };
    remaining.forEach(p => {
      if (marketRemaining[p.R] !== undefined) marketRemaining[p.R]++;
    });

    const auctioned = Store.getAuctionedPlayerIds();
    const allPlayers = Store.getPlayers();

    const availableWishlist = wishlist
      .filter(w => !auctioned.has(w.name))
      .filter(w => {
        if (!callRole) return true;
        const p = allPlayers.find(pl => pl.Nome.toLowerCase().includes(w.name.toLowerCase()));
        return p && p.R === callRole;
      })
      .slice(0, 10)
      .map(w => {
        const p = allPlayers.find(pl => pl.Nome.toLowerCase().includes(w.name.toLowerCase()));
        return p ? { name: p.Nome, role: p.R, team: p.Squadra, base_value: p.QtA, priority: w.priority } : null;
      })
      .filter(Boolean);

    const available = allPlayers.filter(p => !auctioned.has(p.Nome));
    const topAvailable = {};
    const rolesToInclude = callRole ? [callRole] : ['P', 'D', 'C', 'A'];
    rolesToInclude.forEach(r => {
      const needed = meCtx.slots_left[r] || 0;
      if (needed > 0 || callRole) {
        topAvailable[r] = available
          .filter(p => p.R === r)
          .sort((a, b) => b.FVM - a.FVM)
          .slice(0, 5)
          .map(p => ({ name: p.Nome, team: p.Squadra, base_value: p.QtA, fvm: p.FVM }));
      }
    });

    const ctx = { me: meCtx, opponents, my_wishlist: availableWishlist, market_remaining: marketRemaining, top_available: topAvailable };
    if (callRole) ctx.call_role = callRole;
    return ctx;
  },

  SYSTEM_PROMPT: `Sei un esperto di fantacalcio italiano. Asta all'italiana con rilancio variabile.
Analizza il contesto e dai un suggerimento strategico conciso.
Rispondi ESATTAMENTE con un JSON valido, senza testo aggiuntivo.

Per suggerimento rilancio: {"action":"bid"|"pass","max_price":N,"confidence":0.0-1.0,"reason":"spiegazione breve"}
Per suggerimento chiamata: {"recommended_call":{"name":"...","reason":"..."},"bluff_suggestion":{"name":"...","reason":"...","target_opponent":"..."},"max_call_price":N}

Valuta: rapporto qualità/prezzo, crediti residui avversari, slot liberi per ruolo, probabilità che avversari rilancino.
Per il bluff: calcola il danno economico massimo all'avversario.`,

  extractJson(text) {
    let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const start = cleaned.indexOf('{');
    if (start === -1) {
      throw new Error('No JSON found in: ' + text.substring(0, 120));
    }
    cleaned = cleaned.substring(start);
    let lastClose = cleaned.lastIndexOf('}');
    if (lastClose === -1) {
      throw new Error('Incomplete JSON in: ' + text.substring(0, 120));
    }
    let candidate = cleaned.substring(0, lastClose + 1);

    const attempts = [
      s => s,
      s => s.replace(/,\s*([\]}])/g, '$1'),
      s => s.replace(/(["}\]])\s*\n\s*"/g, '$1,"'),
      s => s.replace(/(["}\]])\s*"/g, '$1,"'),
      s => s.replace(/,\s*([\]}])/g, '$1').replace(/(["}\]])\s*"/g, '$1,"'),
    ];

    for (const fix of attempts) {
      try {
        return JSON.parse(fix(candidate));
      } catch (e) { /* try next */ }
    }
    throw new Error('JSON irrecuperabile dopo riparazioni. Riprova.');
  },

  async getSuggestion(player) {
    const cached = Store.cacheGet('bid', player.Nome);
    if (cached) return { ...cached, cached: true };

    const ctx = this.buildBidContext(player);
    const userPrompt = `Contesto asta:\n${JSON.stringify(ctx, null, 2)}\n\nSuggerisci: rilancio o passaggio? Rispondi SOLO con JSON valido.`;
    const raw = await this.callGemini(this.SYSTEM_PROMPT, userPrompt);
    try {
      const result = this.extractJson(raw);
      Store.cacheSet('bid', player.Nome, result, 0);
      return { ...result, cached: false };
    } catch (e) {
      return { action: 'pass', reason: 'Risposta AI non valida: ' + raw.substring(0, 120), cached: false };
    }
  },

  async getCallSuggestion(callRole) {
    const cached = Store.cacheGet('call', callRole || 'all');
    if (cached) return { ...cached, cached: true };

    const ctx = this.buildCallContext(callRole);
    const roleLabel = callRole ? `un ${callRole}` : 'un calciatore';
    const userPrompt = `Contesto asta:\n${JSON.stringify(ctx, null, 2)}\n\nQuale ${roleLabel} chiamare? Rispondi SOLO con JSON valido.`;
    const raw = await this.callGemini(this.SYSTEM_PROMPT, userPrompt);
    try {
      const result = this.extractJson(raw);
      Store.cacheSet('call', callRole || 'all', result, 120000);
      return { ...result, cached: false };
    } catch (e) {
      return { recommended_call: { name: 'N/A', reason: 'Risposta AI non valida: ' + raw.substring(0, 120) }, cached: false };
    }
  },

  buildPreAstaContext() {
    const config = Store.getConfig();
    const participants = Store.getParticipants();
    const teams = Store.getTeams();
    const roles = Store.getConfiguredRoles();
    const wishlist = Store.getWishlist();
    const players = Store.getPlayers();

    const meName = config ? config.myName : (participants[0]?.name || '');
    const meTeam = teams[meName] || { credits: config.credits, roster: { P: [], D: [], C: [], A: [] } };

    const meCtx = { budget: meTeam.credits, slots_left: {}, bought: {} };
    ['P', 'D', 'C', 'A'].forEach(r => {
      meCtx.bought[r] = meTeam.roster[r] ? meTeam.roster[r].length : 0;
      meCtx.slots_left[r] = (roles[r] || 0) - meCtx.bought[r];
    });

    const opponents = participants
      .filter(p => p.name !== meName)
      .map(p => {
        const t = teams[p.name] || { credits: config.credits, roster: { P: [], D: [], C: [], A: [] } };
        const ctx = { name: p.name, budget: t.credits, slots_left: {}, bought: {} };
        ['P', 'D', 'C', 'A'].forEach(r => {
          ctx.bought[r] = t.roster[r] ? t.roster[r].length : 0;
          ctx.slots_left[r] = (roles[r] || 0) - ctx.bought[r];
        });
        return ctx;
      });

    const available = players;
    const topAvailable = {};
    ['P', 'D', 'C', 'A'].forEach(r => {
      const needed = meCtx.slots_left[r] || 0;
      if (needed > 0) {
        topAvailable[r] = available
          .filter(p => p.R === r)
          .sort((a, b) => b.FVM - a.FVM)
          .slice(0, 10)
          .map(p => ({ name: p.Nome, team: p.Squadra, qtA: p.QtA, fvm: p.FVM }));
      }
    });

    const availableWishlist = wishlist
      .map(w => {
        const p = players.find(pl => pl.Nome.toLowerCase().includes(w.name.toLowerCase()));
        return p ? { name: p.Nome, role: p.R, team: p.Squadra, qtA: p.QtA, fvm: p.FVM, priority: w.priority } : null;
      })
      .filter(Boolean);

    const marketRemaining = { P: 0, D: 0, C: 0, A: 0 };
    players.forEach(p => {
      if (marketRemaining[p.R] !== undefined) marketRemaining[p.R]++;
    });

    return {
      league: { name: config.leagueName, participants: participants.length, credits: config.credits, min_bid: config.minBid },
      roster: roles,
      me: meCtx,
      opponents,
      my_wishlist: availableWishlist,
      market_remaining: marketRemaining,
      top_available: topAvailable
    };
  },

  PREASTA_SYSTEM_PROMPT: `Sei un esperto di fantacalcio italiano. Asta all'italiana con rilancio variabile.
Devi generare un piano strategico completo PRIMA dell'asta, basandoti sulle quotazioni e sulle impostazioni della lega.
Rispondi ESATTAMENTE con un JSON valido, senza testo aggiuntivo.

Formato JSON richiesto:
{
  "target_players": {
    "P": [{"name":"...","reason":"...","max_price":N}],
    "D": [{"name":"...","reason":"...","max_price":N}],
    "C": [{"name":"...","reason":"...","max_price":N}],
    "A": [{"name":"...","reason":"...","max_price":N}]
  },
  "value_picks": [{"name":"...","role":"...","reason":"...","max_price":N}],
  "budget_strategy": {
    "P": "consiglio spesa portieri",
    "D": "consiglio spesa difensori",
    "C": "consiglio spesa centrocampisti",
    "A": "consiglio spesa attaccanti"
  },
  "bluff_targets": [{"opponent":"...","strategy":"..."}],
  "general_tips": ["consiglio 1","consiglio 2"]
}

Regole:
- Includi MAX 3 target_players per ruolo che hai slot liberi, ordinati per FVM decrescente
- max_price = prezzo massimo consigliato in crediti
- value_picks = massimo 3 acquisti sottovalutati (FVM alto, QtA basso)
- bluff_targets = massimo 2 avversari da far spendere
- general_tips = massimo 3 consigli
- Usa nomi reali dei giocatori dal dataset, NON nomi fittizi
- Sii conciso: ragioni di max 10 parole`,

  async getPreAstaPlan() {
    const ctx = this.buildPreAstaContext();
    const userPrompt = `Genera un piano strategico completo pre-asta per la mia squadra.\n\nContesto lega:\n${JSON.stringify(ctx, null, 2)}\n\nRispondi SOLO con JSON valido secondo il formato richiesto.`;
    try {
      const raw = await this.callGemini(this.PREASTA_SYSTEM_PROMPT, userPrompt, 2048);
      const result = this.extractJson(raw);
      result.generated_at = Date.now();
      Store.savePreAstaPlan(result);
      return result;
    } catch (e1) {
      const raw2 = await this.callGemini(this.PREASTA_SYSTEM_PROMPT, userPrompt, 2048);
      const result = this.extractJson(raw2);
      result.generated_at = Date.now();
      Store.savePreAstaPlan(result);
      return result;
    }
  }
};
