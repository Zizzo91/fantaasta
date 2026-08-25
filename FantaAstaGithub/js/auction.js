const Auction = {
  currentPlayer: null,
  isUnassigned: false,

  init() {
    this.bindCallerDropdown();
    this.bindCallRoleSelect();
    this.bindSearch('player-search-call', 'player-search-results-call', 'call');
    this.bindSearch('player-search-bid', 'player-search-results-bid', 'bid');
    this.bindActions();
  },

  refresh() {
    const config = Store.getConfig();
    const participants = Store.getParticipants();
    const hasConfig = config && participants.length > 0;
    const hasPlayers = Store.getPlayers().length > 0;

    document.getElementById('auction-empty').classList.toggle('hidden', hasConfig && hasPlayers);
    document.getElementById('auction-content').classList.toggle('hidden', !(hasConfig && hasPlayers));

    if (hasConfig && hasPlayers) {
      this.populateDropdowns();
      this.renderLog();
    }
  },

  populateDropdowns() {
    const participants = Store.getParticipants();
    const dropdown = document.getElementById('caller-dropdown');
    const buyerSelect = document.getElementById('final-buyer');

    const currentVal = dropdown.value;
    dropdown.innerHTML = '<option value="">-- Seleziona --</option>';
    buyerSelect.innerHTML = '';

    participants.forEach(p => {
      dropdown.innerHTML += `<option value="${p.name}">${p.name}</option>`;
      buyerSelect.innerHTML += `<option value="${p.name}">${p.name}</option>`;
    });

    if (currentVal) dropdown.value = currentVal;
  },

  bindCallerDropdown() {
    document.getElementById('caller-dropdown').addEventListener('change', (e) => {
      const val = e.target.value;
      const config = Store.getConfig();
      const myName = config ? config.myName : '';
      const myTurn = document.getElementById('auction-my-turn');
      const otherTurn = document.getElementById('auction-other-turn');

      myTurn.classList.add('hidden');
      otherTurn.classList.add('hidden');
      this.resetSelection('call');
      this.resetSelection('bid');

      if (val && val === myName) {
        myTurn.classList.remove('hidden');
        this.populateCallRoleOptions();
        document.getElementById('call-role-select').value = '';
        document.getElementById('call-role-select').classList.remove('hidden');
        document.getElementById('ai-suggestion-call').classList.add('hidden');
      } else if (val) {
        otherTurn.classList.remove('hidden');
        document.getElementById('caller-name-display').textContent = val;
      }
    });
  },

  populateCallRoleOptions() {
    const roles = Store.getConfiguredRoles();
    const teams = Store.getTeams();
    const config = Store.getConfig();
    const myName = config ? config.myName : '';
    const myTeam = teams[myName] || { roster: { P: [], D: [], C: [], A: [] } };
    const select = document.getElementById('call-role-select');
    const labels = { P: 'Portiere', D: 'Difensore', C: 'Centrocampista', A: 'Attaccante' };
    select.innerHTML = '<option value="">-- Seleziona ruolo --</option>';
    ['P', 'D', 'C', 'A'].forEach(r => {
      const total = roles[r] || 0;
      const bought = myTeam.roster[r] ? myTeam.roster[r].length : 0;
      const left = total - bought;
      if (left > 0) {
        select.innerHTML += `<option value="${r}">${labels[r]} (${bought}/${total})</option>`;
      }
    });
  },

  bindCallRoleSelect() {
    document.getElementById('call-role-select').addEventListener('change', (e) => {
      const role = e.target.value;
      if (role) {
        this.requestAiCallSuggestion(role);
      } else {
        document.getElementById('ai-suggestion-call').classList.add('hidden');
      }
    });
  },

  bindSearch(inputId, resultsId, mode) {
    const input = document.getElementById(inputId);
    const results = document.getElementById(resultsId);

    input.addEventListener('input', () => {
      const query = input.value.trim();
      if (query.length < 2) {
        results.classList.add('hidden');
        return;
      }
      const matches = Store.searchPlayers(query);
      if (matches.length === 0) {
        results.innerHTML = '<div class="search-result-item" style="color:var(--text-muted)">Nessun risultato</div>';
        results.classList.remove('hidden');
        return;
      }
      results.innerHTML = matches.map(p => `
        <div class="search-result-item" data-name="${p.Nome}">
          <span class="sr-name">${p.Nome}</span>
          <span class="sr-info">${p.R} | ${p.Squadra} | qt. ${p.QtA}</span>
        </div>
      `).join('');
      results.classList.remove('hidden');

      results.querySelectorAll('.search-result-item[data-name]').forEach(item => {
        item.addEventListener('click', () => {
          const name = item.dataset.name;
          const player = Store.getPlayerByName(name);
          if (player) this.selectPlayer(player, mode);
          results.classList.add('hidden');
          input.value = '';
        });
      });
    });

    input.addEventListener('blur', () => {
      setTimeout(() => results.classList.add('hidden'), 200);
    });
  },

  selectPlayer(player, mode) {
    this.currentPlayer = player;
    this.isUnassigned = false;
    const sectionId = mode === 'call' ? 'selected-player-call' : 'selected-player-bid';
    const section = document.getElementById(sectionId);
    section.classList.remove('hidden');
    section.innerHTML = `
      <div>
        <span class="sp-name">${player.Nome}</span>
        <span class="sp-info">${player.R} | ${player.Squadra} | qt. ${player.QtA}</span>
      </div>
    `;

    if (mode === 'call') {
      document.getElementById('confirm-call').classList.remove('hidden');
    } else {
      document.getElementById('current-bid-section').classList.remove('hidden');
      document.getElementById('current-bid-price').value = player.QtA;
      document.getElementById('bid-actions').classList.remove('hidden');
      document.getElementById('finalize-section').classList.add('hidden');
      document.getElementById('context-panel').classList.remove('hidden');
      this.renderContext(player);
      this.requestAiBidSuggestion(player);
    }
  },

  resetSelection(mode) {
    if (mode === 'call') {
      document.getElementById('selected-player-call').classList.add('hidden');
      document.getElementById('confirm-call').classList.add('hidden');
      document.getElementById('ai-suggestion-call').classList.add('hidden');
      document.getElementById('call-role-select').value = '';
    } else {
      document.getElementById('selected-player-bid').classList.add('hidden');
      document.getElementById('current-bid-section').classList.add('hidden');
      document.getElementById('bid-actions').classList.add('hidden');
      document.getElementById('finalize-section').classList.add('hidden');
      document.getElementById('context-panel').classList.add('hidden');
      document.getElementById('ai-suggestion-bid').classList.add('hidden');
    }
    this.currentPlayer = null;
  },

  renderContext(player) {
    const config = Store.getConfig();
    const participants = Store.getParticipants();
    const teams = Store.getTeams();
    const roles = Store.getConfiguredRoles();
    const callerName = document.getElementById('caller-dropdown').value;
    const myName = config ? config.myName : '';

    let html = '<table class="context-table">';
    participants.forEach(p => {
      const team = teams[p.name] || { credits: p.credits, roster: { P: [], D: [], C: [], A: [] } };
      const isMe = (p.name === myName);
      const isCaller = (p.name === callerName);
      const style = isCaller ? 'font-weight:600;color:var(--warning)' : (isMe ? 'font-weight:600;color:var(--primary)' : '');
      html += `<tr style="${style}">
        <td class="ctx-name">${p.name}${isMe ? ' (Io)' : ''}${isCaller ? ' *' : ''}</td>
        <td>${team.credits}cr</td>`;
      ['P', 'D', 'C', 'A'].forEach(r => {
        const bought = team.roster[r] ? team.roster[r].length : 0;
        const total = roles[r] || 0;
        const left = total - bought;
        const color = left <= 0 ? 'var(--danger)' : (left <= 2 ? 'var(--warning)' : 'var(--text-muted)');
        html += `<td style="color:${color}">${r}:${bought}/${total} (${left} liberi)</td>`;
      });
      html += '</tr>';
    });
    html += '</table>';
    document.getElementById('context-info').innerHTML = html;
  },

  bindActions() {
    document.getElementById('confirm-call').addEventListener('click', () => {
      if (!this.currentPlayer) return;
      const config = Store.getConfig();
      this.showFinalizeSale(config ? config.myName : '');
    });

    document.getElementById('btn-finalize').addEventListener('click', () => {
      if (!this.currentPlayer) return;
      const buyer = document.getElementById('caller-dropdown').value;
      this.showFinalizeSale(buyer);
    });

    const handleUnassigned = () => {
      if (!this.currentPlayer) return;
      Store.recordUnassigned(this.currentPlayer);
      this.resetAll();
      this.refresh();
      Dashboard.refresh();
    };

    document.getElementById('btn-unassigned').addEventListener('click', handleUnassigned);
    document.getElementById('btn-unassigned2').addEventListener('click', handleUnassigned);

    document.getElementById('btn-confirm-sale').addEventListener('click', () => {
      if (!this.currentPlayer) return;
      const buyer = document.getElementById('final-buyer').value;
      const price = parseInt(document.getElementById('final-price').value);
      if (!buyer || !price || price < 1) {
        alert('Seleziona acquirente e prezzo validi');
        return;
      }
      Store.recordSale(this.currentPlayer, buyer, price);
      this.resetAll();
      this.refresh();
      Dashboard.refresh();
    });

    document.getElementById('btn-cancel-sale').addEventListener('click', () => {
      document.getElementById('finalize-section').classList.add('hidden');
      const caller = document.getElementById('caller-dropdown').value;
      const config = Store.getConfig();
      if (caller === config.myName) {
        document.getElementById('bid-actions').classList.add('hidden');
      } else {
        document.getElementById('bid-actions').classList.remove('hidden');
      }
    });

    document.getElementById('btn-pass').addEventListener('click', () => {
      this.resetSelection('bid');
    });
  },

  resetAll() {
    this.resetSelection('call');
    this.resetSelection('bid');
    document.getElementById('finalize-section').classList.add('hidden');
    document.getElementById('bid-actions').classList.add('hidden');
    document.getElementById('context-panel').classList.add('hidden');
    this.currentPlayer = null;
  },

  showFinalizeSale(defaultBuyer) {
    document.getElementById('bid-actions').classList.add('hidden');
    document.getElementById('finalize-section').classList.remove('hidden');
    if (defaultBuyer) {
      document.getElementById('final-buyer').value = defaultBuyer;
    }
    document.getElementById('final-price').value = this.currentPlayer.QtA;
  },

  async requestAiBidSuggestion(player) {
    const box = document.getElementById('ai-suggestion-bid');
    if (!Advisor.isConfigured()) {
      box.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');
    box.innerHTML = '<div class="ai-label">AI sta analizzando...</div><div class="ai-reason">Richiesta in corso...</div>';

    try {
      const suggestion = await Advisor.getSuggestion(player);
      box.innerHTML = `
        <div class="ai-label">AI Suggerimento</div>
        <div class="ai-action ${suggestion.action}">${suggestion.action === 'bid' ? 'RILANCIA' : 'MOLLA'}</div>
        ${suggestion.max_price ? `<div class="ai-max">Prezzo massimo: <strong>${suggestion.max_price}cr</strong></div>` : ''}
        <div class="ai-reason">${suggestion.reason}</div>
      `;
    } catch (err) {
      box.innerHTML = `<div class="ai-label">AI Errore</div><div class="ai-reason">${err.message}</div>`;
    }
  },

  async requestAiCallSuggestion(callRole) {
    const box = document.getElementById('ai-suggestion-call');
    if (!Advisor.isConfigured()) {
      box.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');
    const roleLabels = { P: 'Portiere', D: 'Difensore', C: 'Centrocampista', A: 'Attaccante' };
    const roleLabel = callRole ? roleLabels[callRole] : '';
    box.innerHTML = `<div class="ai-label">AI sta analizzando...</div><div class="ai-reason">Sto valutando ${roleLabel ? 'migliori ' + roleLabel.toLowerCase() + '...' : 'le migliori opzioni...'}</div>`;

    try {
      const suggestion = await Advisor.getCallSuggestion(callRole);
      let html = `<div class="ai-label">AI Suggerimento Chiamata${roleLabel ? ' — ' + roleLabel : ''}</div>`;

      if (suggestion.recommended_call) {
        html += `
          <div class="ai-action call">CHIAMATA CONSIGLIATA: ${suggestion.recommended_call.name}</div>
          <div class="ai-reason">${suggestion.recommended_call.reason || ''}</div>
        `;
      }

      if (suggestion.bluff_suggestion && suggestion.bluff_suggestion.name) {
        html += `
          <div class="ai-max" style="margin-top:0.5rem;color:var(--warning)">
            Bluff: ${suggestion.bluff_suggestion.name}
            ${suggestion.bluff_suggestion.target_opponent ? ` → per far spendere a ${suggestion.bluff_suggestion.target_opponent}` : ''}
          </div>
          <div class="ai-reason">${suggestion.bluff_suggestion.reason || ''}</div>
        `;
      }

      if (suggestion.max_call_price) {
        html += `<div class="ai-max" style="margin-top:0.5rem">Prezzo max consigliato: <strong>${suggestion.max_call_price}cr</strong></div>`;
      }

      box.innerHTML = html;
    } catch (err) {
      box.innerHTML = `<div class="ai-label">AI Errore</div><div class="ai-reason">${err.message}</div>`;
    }
  },

  renderLog() {
    const log = Store.getAuctionLog();
    const container = document.getElementById('auction-log');
    if (log.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Nessuna registrazione ancora.</p>';
      return;
    }
    container.innerHTML = log.slice().reverse().map(e => `
      <div class="log-entry">
        <span class="log-num">#${e.num}</span>
        <span>
          <span class="log-player">${e.player}</span>
          <span class="log-role">${e.role} | ${e.team}</span>
        </span>
        <span class="log-result">
          ${e.buyer
            ? `<span class="log-price">${e.price}cr</span> <span class="log-buyer">${e.buyer}</span>`
            : '<span class="log-unassigned">Svincolato</span>'}
        </span>
      </div>
    `).join('');
  }
};
