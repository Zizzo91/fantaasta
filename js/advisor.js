const Advisor = {
  isConfigured() {
    return !!Store.getApiKey();
  },

  async callGemini(systemPrompt, userPrompt) {
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
        maxOutputTokens: 1024
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
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('No JSON found in: ' + text.substring(0, 120));
    }
    return JSON.parse(cleaned.substring(start, end + 1));
  },

  async getSuggestion(player) {
    const ctx = this.buildBidContext(player);
    const userPrompt = `Contesto asta:\n${JSON.stringify(ctx, null, 2)}\n\nSuggerisci: rilancio o passaggio? Rispondi SOLO con JSON valido.`;
    const raw = await this.callGemini(this.SYSTEM_PROMPT, userPrompt);
    try {
      return this.extractJson(raw);
    } catch (e) {
      return { action: 'pass', reason: 'Risposta AI non valida: ' + raw.substring(0, 120) };
    }
  },

  async getCallSuggestion(callRole) {
    const ctx = this.buildCallContext(callRole);
    const roleLabel = callRole ? `un ${callRole}` : 'un calciatore';
    const userPrompt = `Contesto asta:\n${JSON.stringify(ctx, null, 2)}\n\nQuale ${roleLabel} chiamare? Rispondi SOLO con JSON valido.`;
    const raw = await this.callGemini(this.SYSTEM_PROMPT, userPrompt);
    try {
      return this.extractJson(raw);
    } catch (e) {
      return { recommended_call: { name: 'N/A', reason: 'Risposta AI non valida: ' + raw.substring(0, 120) } };
    }
  }
};
