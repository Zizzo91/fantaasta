const Dashboard = {
  DEFAULT_ORDER: ['my-roster', 'credits-ranking', 'spending-ranking', 'market-remaining', 'wishlist-status', 'budget-simulator', 'budget-planner', 'preasta-planner', 'player-compare', 'low-cost-filter', 'formation-field'],

  init() {
    document.getElementById('btn-share').addEventListener('click', () => this.generateShareImage());
  },

  initDashboardDrag() {
    const grid = document.querySelector('.dashboard-grid');
    if (!grid || typeof Sortable === 'undefined') return;

    this.applyCardOrder();
    this.applyCardWidths();
    this.applyCardCollapsed();

    Sortable.create(grid, {
      animation: 150,
      handle: '.dash-card-handle',
      ghostClass: 'dash-card-ghost',
      chosenClass: 'dash-card-chosen',
      dragClass: 'dash-card-drag',
      draggable: '.dash-card',
      onEnd: () => {
        const all = Array.from(grid.querySelectorAll('.dash-card')).map(c => c.dataset.id);
        Store.saveDashboardOrder(all);
      }
    });

    grid.addEventListener('click', (e) => {
      const toggle = e.target.closest('.dash-card-toggle');
      if (toggle) {
        const id = toggle.dataset.target;
        const card = grid.querySelector(`[data-id="${id}"]`);
        if (!card) return;
        card.classList.toggle('dash-card-wide');
        const widths = Store.getCardWidths();
        widths[id] = card.classList.contains('dash-card-wide');
        Store.saveCardWidths(widths);
        return;
      }

      const collapse = e.target.closest('.dash-card-collapse');
      if (collapse) {
        const id = collapse.dataset.target;
        const card = grid.querySelector(`[data-id="${id}"]`);
        if (!card) return;
        card.classList.toggle('dash-card-collapsed');
        const collapsed = Store.getCardCollapsed();
        collapsed[id] = card.classList.contains('dash-card-collapsed');
        Store.saveCardCollapsed(collapsed);
        collapse.textContent = collapsed[id] ? '▶' : '▼';
      }
    });
  },

  applyCardOrder() {
    const grid = document.querySelector('.dashboard-grid');
    if (!grid) return;
    const savedOrder = Store.getDashboardOrder() || this.DEFAULT_ORDER;
    const cards = Array.from(grid.querySelectorAll('.dash-card'));

    savedOrder.forEach(id => {
      const card = cards.find(c => c.dataset.id === id);
      if (card) grid.appendChild(card);
    });
  },

  applyCardWidths() {
    const grid = document.querySelector('.dashboard-grid');
    if (!grid) return;
    const widths = Store.getCardWidths();
    Object.keys(widths).forEach(id => {
      if (!widths[id]) return;
      const card = grid.querySelector(`[data-id="${id}"]`);
      if (card) card.classList.add('dash-card-wide');
    });
  },

  applyCardCollapsed() {
    const grid = document.querySelector('.dashboard-grid');
    if (!grid) return;
    const collapsed = Store.getCardCollapsed();
    Object.keys(collapsed).forEach(id => {
      if (!collapsed[id]) return;
      const card = grid.querySelector(`[data-id="${id}"]`);
      if (card) {
        card.classList.add('dash-card-collapsed');
        const btn = card.querySelector('.dash-card-collapse');
        if (btn) btn.textContent = '▶';
      }
    });
  },

  initSpendingExpand() {
    const btn = document.getElementById('btn-spending-expand');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const expanded = !Store.getSpendingExpanded();
      Store.saveSpendingExpanded(expanded);
      this.refresh();
    });
  },

  applySpendingExpand() {
    const card = document.querySelector('.dash-card[data-id="spending-ranking"]');
    if (!card) return;
    const expanded = Store.getSpendingExpanded();
    card.classList.toggle('expanded', expanded);
    const btn = document.getElementById('btn-spending-expand');
    if (btn) btn.textContent = expanded ? '⤡' : '⤢';
    btn.title = expanded ? 'Comprimi' : 'Espandi';
  },

  initRosterExpand() {
    const btn = document.getElementById('btn-roster-expand');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const expanded = !Store.getRosterExpanded();
      Store.saveRosterExpanded(expanded);
      this.refresh();
    });
  },

  applyRosterExpand() {
    const card = document.querySelector('.dash-card[data-id="my-roster"]');
    if (!card) return;
    const expanded = Store.getRosterExpanded();
    card.classList.toggle('expanded', expanded);
    const btn = document.getElementById('btn-roster-expand');
    if (btn) btn.textContent = expanded ? '⤡' : '⤢';
    btn.title = expanded ? 'Comprimi' : 'Espandi';
  },

  refresh() {
    const config = Store.getConfig();
    const participants = Store.getParticipants();
    const hasConfig = config && participants.length > 0;

    document.getElementById('dashboard-empty').classList.toggle('hidden', hasConfig);
    document.getElementById('dashboard-content').classList.toggle('hidden', !hasConfig);

    if (hasConfig) {
      this.renderMyRoster();
      this.renderCreditsRanking();
      this.renderSpendingRanking();
      this.renderMarketRemaining();
      this.renderWishlistStatus();
      this.renderBudgetSimulator();
      this.renderBudgetPlanner();
      this.renderPreAstaPlanner();
      this.renderPlayerCompare();
      this.renderLowCostFilter();
      this.renderFormationField();
    }

    this.applySpendingExpand();
    this.applyRosterExpand();
  },

  renderMyRoster() {
    const teams = Store.getTeams();
    const roles = Store.getConfiguredRoles();
    const participants = Store.getParticipants();
    const config = Store.getConfig();
    const myName = config ? config.myName : '';
    const container = document.getElementById('my-roster');

    if (participants.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted)">Nessun partecipante configurato.</p>';
      return;
    }

    let html = '';
    Object.keys(teams).forEach(name => {
      const team = teams[name];
      const isMe = (name === myName);
      html += `<h4 style="margin:0.75rem 0 0.4rem">${name}${isMe ? ' (Io)' : ''}</h4>`;
      ['P', 'D', 'C', 'A'].forEach(r => {
        const bought = team.roster[r] ? team.roster[r].length : 0;
        const total = roles[r] || 0;
        const pct = total > 0 ? (bought / total) * 100 : 0;
        const over = bought > total;
        html += `
          <div class="roster-bar">
            <span class="role-label">${r}</span>
            <div class="bar-track">
              <div class="bar-fill ${over ? 'over' : ''}" style="width:${Math.min(pct, 100)}%"></div>
            </div>
            <span class="bar-text">${bought}/${total}</span>
          </div>
        `;
      });
      if (team.roster) {
        ['P', 'D', 'C', 'A'].forEach(r => {
          if (team.roster[r] && team.roster[r].length > 0) {
            html += `<div class="roster-players">`;
            html += team.roster[r].map(p =>
              `<span class="roster-player">${p.name} <span class="roster-price">(${p.price}cr)</span><button class="roster-remove" data-player="${p.name}" data-owner="${name}" data-role="${r}" data-price="${p.price}" title="Rimuovi">&times;</button></span>`
            ).join(', ');
            html += `</div>`;
          }
        });
      }
    });
    container.innerHTML = html;

    container.querySelectorAll('.roster-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const playerName = btn.dataset.player;
        const ownerName = btn.dataset.owner;
        const price = btn.dataset.price;
        if (!confirm(`Rimuovere ${playerName} dalla rosa di ${ownerName}?\nRimborso: ${price}cr`)) return;
        const result = Store.removePlayerFromRoster(playerName, ownerName);
        if (result.success) {
          this.refresh();
          Auction.refresh();
        } else {
          alert('Errore: ' + result.error);
        }
      });
    });
  },

  renderCreditsRanking() {
    const teams = Store.getTeams();
    const container = document.getElementById('credits-ranking');
    const config = Store.getConfig();
    const maxCredits = config ? parseInt(config.credits) || 250 : 250;

    const sorted = Object.entries(teams)
      .map(([name, t]) => ({ name, credits: t.credits }))
      .sort((a, b) => b.credits - a.credits);

    container.innerHTML = sorted.map(t => {
      const pct = maxCredits > 0 ? (t.credits / maxCredits) * 100 : 0;
      return `
        <div class="credit-row">
          <span class="name">${t.name}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%"></div>
          </div>
          <span class="credits">${t.credits}cr</span>
        </div>
      `;
    }).join('');
  },

  renderSpendingRanking() {
    const teams = Store.getTeams();
    const players = Store.getPlayers();
    const container = document.getElementById('spending-ranking');

    const rankings = Object.entries(teams).map(([name, team]) => {
      let totalSpent = 0;
      let playerCount = 0;
      let totalFvm = 0;
      ['P', 'D', 'C', 'A'].forEach(r => {
        if (team.roster[r]) {
          team.roster[r].forEach(p => {
            totalSpent += p.price;
            playerCount++;
            const csvPlayer = players.find(pl => pl.Nome === p.name);
            if (csvPlayer) totalFvm += csvPlayer.FVM || 0;
          });
        }
      });
      const avgPrice = playerCount > 0 ? (totalSpent / playerCount).toFixed(1) : 0;
      const avgFvm = playerCount > 0 ? (totalFvm / playerCount).toFixed(1) : 0;
      const valueRatio = totalSpent > 0 ? (totalFvm / totalSpent).toFixed(2) : '0.00';
      return { name, totalSpent, playerCount, avgPrice, avgFvm, valueRatio };
    }).sort((a, b) => b.totalSpent - a.totalSpent);

    if (rankings.every(r => r.playerCount === 0)) {
      container.innerHTML = '<p style="color:var(--text-muted)">Nessun acquisto ancora.</p>';
      return;
    }

    const maxSpent = Math.max(...rankings.map(r => r.totalSpent), 1);

    container.innerHTML = `
      <div class="spending-table-wrap">
        <table class="spending-table">
          <thead>
            <tr>
              <th></th>
              <th title="Nome partecipante">N</th>
              <th title="Giocatori acquistati">Gioc.</th>
              <th title="Crediti totali spesi">Spesi</th>
              <th title="Prezzo medio per giocatore">Media</th>
              <th class="th-info" data-metric="fvm" title="Clicca per sapere cos'è">FVM ⓘ</th>
              <th class="th-info" data-metric="qp" title="Clicca per sapere cos'è">Q/P ⓘ</th>
            </tr>
          </thead>
          <tbody>
            ${rankings.map((r, i) => {
              const pct = maxSpent > 0 ? (r.totalSpent / maxSpent) * 100 : 0;
              return `<tr>
                <td class="spend-rank">${i + 1}</td>
                <td class="spend-name">${r.name}</td>
                <td>${r.playerCount}</td>
                <td>
                  <div class="spend-bar-wrap">
                    <div class="spend-bar" style="width:${pct}%"></div>
                    <span>${r.totalSpent}cr</span>
                  </div>
                </td>
                <td>${r.avgPrice}cr</td>
                <td>${r.avgFvm}</td>
                <td class="${parseFloat(r.valueRatio) >= 1 ? 'value-good' : 'value-bad'}">${r.valueRatio}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.querySelectorAll('.th-info').forEach(th => {
      th.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showMetricOverlay(th.dataset.metric, th);
      });
    });
  },

  showMetricOverlay(metric, thEl) {
    this.hideMetricOverlay();

    const overlay = document.createElement('div');
    overlay.id = 'metric-overlay';
    overlay.className = 'metric-overlay';

    const content = {
      fvm: {
        title: 'FVM — Fantacalcio Valore Medio',
        desc: 'Indica la qualità media dei giocatori nella tua rosa, calcolata dal valore FVM presente nel CSV delle quotazioni. Più è alto, più la tua rosa è forte sulla carta.',
        formula: 'FVM medio = somma FVM di tutti i giocatori ÷ numero di giocatori',
        example: 'Esempio: 3 acquisti con FVM 40, 35 e 30 → media = 35'
      },
      qp: {
        title: 'Q/P — Qualità / Prezzo',
        desc: 'Misura l\'efficienza della spesa: quanta qualità hai ottenuto per ogni credito speso. Più è alto, più il tuo acquisto è un affare.',
        formula: 'Q/P = FVM totale della rosa ÷ crediti totali spesi',
        example: 'Esempio: FVM totale 70, spesi 50cr → 70/50 = 1,40 (verde = conviene). Sotto 1,00 = rosso (hai pagato caro).'
      }
    };

    const c = content[metric];
    overlay.innerHTML = `
      <div class="overlay-header">
        <strong>${c.title}</strong>
        <button class="overlay-close" title="Chiudi">&times;</button>
      </div>
      <p>${c.desc}</p>
      <div class="overlay-formula">${c.formula}</div>
      <p class="overlay-example">${c.example}</p>
    `;

    document.body.appendChild(overlay);

    const rect = thEl.getBoundingClientRect();
    overlay.style.position = 'fixed';
    overlay.style.top = (rect.bottom + 6) + 'px';
    const overlayWidth = 340;
    let left = rect.left + rect.width / 2 - overlayWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - overlayWidth - 8));
    overlay.style.left = left + 'px';
    overlay.style.width = overlayWidth + 'px';

    overlay.querySelector('.overlay-close').addEventListener('click', () => this.hideMetricOverlay());

    const onOutside = (e) => {
      if (!overlay.contains(e.target) && !thEl.contains(e.target)) {
        this.hideMetricOverlay();
        document.removeEventListener('click', onOutside);
      }
    };
    setTimeout(() => document.addEventListener('click', onOutside), 0);

    const onEsc = (e) => {
      if (e.key === 'Escape') {
        this.hideMetricOverlay();
        document.removeEventListener('keydown', onEsc);
      }
    };
    document.addEventListener('keydown', onEsc);
  },

  hideMetricOverlay() {
    const existing = document.getElementById('metric-overlay');
    if (existing) existing.remove();
  },

  renderMarketRemaining() {
    const count = Store.getMarketRemaining();
    const container = document.getElementById('market-remaining');
    const labels = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' };

    container.innerHTML = ['P', 'D', 'C', 'A'].map(r => `
      <div class="roster-bar">
        <span class="role-label">${r}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width:100%"></div>
        </div>
        <span class="bar-text">${count[r]}</span>
        <span class="bar-label">${labels[r]}</span>
      </div>
    `).join('');
  },

  renderWishlistStatus() {
    const wishlist = Store.getWishlist();
    const players = Store.getPlayers();
    const auctioned = Store.getAuctionedPlayerIds();
    const container = document.getElementById('wishlist-status');

    if (wishlist.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted)">Nessuna wishlist configurata.</p>';
      return;
    }

    container.innerHTML = wishlist.map(w => {
      const player = players.find(p => p.Nome.toLowerCase().includes(w.name.toLowerCase()));
      let status = 'available';
      let statusLabel = 'Disponibile';
      if (player) {
        if (auctioned.has(player.Nome)) {
          const log = Store.getAuctionLog();
          const entry = log.find(e => e.player === player.Nome);
          if (entry && entry.buyer) {
            status = 'bought';
            statusLabel = `Preso da ${entry.buyer} (${entry.price}cr)`;
          } else {
            status = 'missed';
            statusLabel = 'Svincolato';
          }
        }
      } else {
        status = 'missed';
        statusLabel = 'Non trovato nel CSV';
      }
      return `
        <div class="wishlist-item">
          <span class="priority">${w.priority}</span>
          <span class="w-name">${w.name}${player ? ` (${player.R}, ${player.Squadra})` : ''}</span>
          <span class="w-status ${status}">${statusLabel}</span>
        </div>
      `;
    }).join('');
  },

  renderBudgetSimulator() {
    const container = document.getElementById('budget-simulator');
    const config = Store.getConfig();
    const participants = Store.getParticipants();
    const teams = Store.getTeams();
    const roles = Store.getConfiguredRoles();

    if (!config || participants.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted)">Configura la lega prima.</p>';
      return;
    }

    container.innerHTML = `
      <div class="sim-controls">
        <div class="form-group">
          <label for="sim-team">Partecipante</label>
          <select id="sim-team">
            ${participants.map(p => `<option value="${p.name}">${p.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="position:relative">
          <label for="sim-player-search">Calciatore</label>
          <input type="text" id="sim-player-search" placeholder="Cerca..." autocomplete="off">
          <div id="sim-player-results" class="search-results hidden"></div>
        </div>
        <div class="form-group">
          <label for="sim-price">Prezzo</label>
          <input type="number" id="sim-price" min="1" value="10">
        </div>
      </div>
      <div id="sim-result" class="sim-result hidden"></div>
    `;

    const searchInput = document.getElementById('sim-player-search');
    const resultsDiv = document.getElementById('sim-player-results');
    const priceInput = document.getElementById('sim-price');
    const resultDiv = document.getElementById('sim-result');
    let selectedPlayer = null;

    const updateResult = () => {
      const teamName = document.getElementById('sim-team').value;
      const price = parseInt(priceInput.value) || 0;
      const team = teams[teamName];
      if (!team || !selectedPlayer || price < 1) {
        resultDiv.classList.add('hidden');
        return;
      }

      const remainingCredits = team.credits - price;
      const mainRole = selectedPlayer.R;
      const currentBought = team.roster[mainRole] ? team.roster[mainRole].length : 0;
      const totalSlots = roles[mainRole] || 0;
      const remainingSlots = totalSlots - currentBought - 1;

      let html = '<div class="sim-result-inner">';
      html += `<div class="sim-row ${remainingCredits < 0 ? 'sim-danger' : ''}">Crediti rimanenti: <strong>${remainingCredits}cr</strong></div>`;
      html += `<div class="sim-row">Slot ${mainRole} rimanenti: <strong>${remainingSlots}</strong></div>`;
      html += '<div class="sim-rosa">';
      ['P', 'D', 'C', 'A'].forEach(r => {
        const bought = team.roster[r] ? team.roster[r].length : 0;
        const total = roles[r] || 0;
        const extra = r === mainRole ? 1 : 0;
        html += `<div class="sim-role">
          <span class="sim-role-label">${r}</span>
          <span class="sim-role-count ${bought + extra > total ? 'over' : ''}">${bought + extra}/${total}</span>
        </div>`;
      });
      html += '</div></div>';
      resultDiv.innerHTML = html;
      resultDiv.classList.remove('hidden');
    };

    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim();
      if (query.length < 2) {
        resultsDiv.classList.add('hidden');
        return;
      }
      const matches = Store.searchPlayers(query);
      if (matches.length === 0) {
        resultsDiv.innerHTML = '<div class="search-result-item" style="color:var(--text-muted)">Nessun risultato</div>';
        resultsDiv.classList.remove('hidden');
        return;
      }
      resultsDiv.innerHTML = matches.map(p => `
        <div class="search-result-item" data-name="${p.Nome}">
          <span class="sr-name">${p.Nome}</span>
          <span class="sr-info">${p.R} | ${p.Squadra} | qt. ${p.QtA}</span>
        </div>
      `).join('');
      resultsDiv.classList.remove('hidden');

      resultsDiv.querySelectorAll('.search-result-item[data-name]').forEach(item => {
        item.addEventListener('click', () => {
          const name = item.dataset.name;
          selectedPlayer = Store.getPlayerByName(name);
          if (selectedPlayer) {
            searchInput.value = selectedPlayer.Nome;
            priceInput.value = selectedPlayer.QtA;
            updateResult();
          }
          resultsDiv.classList.add('hidden');
        });
      });
    });

    searchInput.addEventListener('blur', () => {
      setTimeout(() => resultsDiv.classList.add('hidden'), 200);
    });

    priceInput.addEventListener('input', updateResult);
    document.getElementById('sim-team').addEventListener('change', updateResult);
  },

  renderBudgetPlanner() {
    const container = document.getElementById('budget-planner');
    const config = Store.getConfig();
    const roles = Store.getConfiguredRoles();
    const data = Store.getBudgetPlanner();

    if (!config) {
      container.innerHTML = '<p style="color:var(--text-muted)">Configura la lega prima.</p>';
      return;
    }

    const totalCredits = parseInt(config.credits) || 250;
    const totalSlots = roles.P + roles.D + roles.C + roles.A;

    const render = () => {
      const pcts = { P: data.P || 0, D: data.D || 0, C: data.C || 0, A: data.A || 0 };
      const sum = pcts.P + pcts.D + pcts.C + pcts.A;
      const isBalanced = sum === 100;

      let html = '<div class="bp-header">';
      html += `<span class="bp-total">Budget: <strong>${totalCredits}cr</strong> | Rose: <strong>${totalSlots} slot</strong></span>`;
      html += `<span class="bp-sum ${isBalanced ? '' : 'bp-warn'}">${sum}%</span>`;
      html += '</div>';

      html += '<div class="bp-bar">';
      ['P', 'D', 'C', 'A'].forEach(r => {
        if (pcts[r] > 0) {
          html += `<div class="bp-bar-seg bp-bar-${r}" style="width:${pcts[r]}%">${pcts[r]}%</div>`;
        }
      });
      html += '</div>';

      html += '<div class="bp-roles">';
      ['P', 'D', 'C', 'A'].forEach(r => {
        const credits = Math.round(totalCredits * pcts[r] / 100);
        const slotCount = roles[r] || 0;
        const perSlot = slotCount > 0 ? Math.round(credits / slotCount) : 0;
        const roleLabels = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' };

        html += `<div class="bp-role">
          <div class="bp-role-header">
            <span class="bp-role-label bp-color-${r}">${roleLabels[r]}</span>
            <span class="bp-role-credits">${credits}cr</span>
          </div>
          <div class="bp-slider-row">
            <input type="range" min="0" max="100" value="${pcts[r]}" data-role="${r}" class="bp-slider bp-slider-${r}">
            <input type="number" min="0" max="100" value="${pcts[r]}" data-role="${r}" class="bp-pct-input">
            <span class="bp-pct-sign">%</span>
          </div>
          <div class="bp-role-detail">${slotCount} slot &rarr; ~${perSlot}cr/a</div>
        </div>`;
      });
      html += '</div>';

      const alerts = [];
      if (!isBalanced) alerts.push({ type: 'warn', msg: `Totale ${sum}%: deve essere 100%` });
      if (roles.P > 0 && pcts.P < 5) alerts.push({ type: 'warn', msg: 'Pochi crediti per i portieri (<5%)' });
      ['D', 'C', 'A'].forEach(r => {
        const slotCount = roles[r] || 0;
        const credits = Math.round(totalCredits * pcts[r] / 100);
        const perSlot = slotCount > 0 ? Math.round(credits / slotCount) : 0;
        if (pcts[r] > 0 && perSlot > 40) alerts.push({ type: 'info', msg: `${r}: ~${perSlot}cr/slot — potrebbe essere troppo alto` });
      });
      if (totalCredits * pcts.P / 100 > totalCredits * 0.4) {
        alerts.push({ type: 'warn', msg: 'Portieri >40% del budget — considera di ridurre' });
      }

      if (alerts.length > 0) {
        html += '<div class="bp-alerts">';
        alerts.forEach(a => {
          html += `<div class="bp-alert bp-alert-${a.type}">${a.msg}</div>`;
        });
        html += '</div>';
      }

      container.innerHTML = html;

      container.querySelectorAll('.bp-slider').forEach(slider => {
        slider.addEventListener('change', (e) => {
          const role = e.target.dataset.role;
          data[role] = parseInt(e.target.value) || 0;
          Store.saveBudgetPlanner(data);
          render();
        });
      });

      container.querySelectorAll('.bp-pct-input').forEach(input => {
        input.addEventListener('change', (e) => {
          const role = e.target.dataset.role;
          data[role] = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
          Store.saveBudgetPlanner(data);
          render();
        });
      });
    };

    render();
  },

  renderPreAstaPlanner() {
    const container = document.getElementById('preasta-planner');
    const plan = Store.getPreAstaPlan();
    const config = Store.getConfig();
    const hasPlayers = Store.getPlayers().length > 0;

    if (!hasPlayers) {
      container.innerHTML = '<p style="color:var(--text-muted)">Carica il CSV delle quotazioni prima.</p>';
      return;
    }

    if (plan) {
      const date = new Date(plan.generated_at).toLocaleString('it-IT');
      let html = `<div class="preasta-meta">Generato il ${date}</div>`;

      if (plan.target_players) {
        const roleLabels = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' };
        ['P', 'D', 'C', 'A'].forEach(r => {
          const list = plan.target_players[r];
          if (!list || list.length === 0) return;
          const needed = (config ? (parseInt(config['roster' + r]) || 0) : 0);
          if (needed <= 0) return;
          html += `<div class="preasta-section">
            <h4>${roleLabels[r]} <span class="preasta-badge">${list.length} obiettivi</span></h4>
            <div class="preasta-targets">`;
          list.forEach(p => {
            html += `<div class="preasta-target">
              <span class="preasta-name">${p.name}</span>
              <span class="preasta-price">${p.max_price}cr</span>
              <span class="preasta-reason">${p.reason || ''}</span>
            </div>`;
          });
          html += '</div></div>';
        });
      }

      if (plan.value_picks && plan.value_picks.length > 0) {
        html += '<div class="preasta-section"><h4>Affari <span class="preasta-badge">value</span></h4><div class="preasta-targets">';
        plan.value_picks.forEach(p => {
          html += `<div class="preasta-target">
            <span class="preasta-name">${p.name}</span>
            <span class="preasta-role">${p.role}</span>
            <span class="preasta-price">${p.max_price}cr</span>
            <span class="preasta-reason">${p.reason || ''}</span>
          </div>`;
        });
        html += '</div></div>';
      }

      if (plan.budget_strategy) {
        html += '<div class="preasta-section"><h4>Strategia Budget</h4><div class="preasta-budget">';
        ['P', 'D', 'C', 'A'].forEach(r => {
          const tip = plan.budget_strategy[r];
          if (tip) {
            html += `<div class="preasta-budget-row"><span class="preasta-budget-role">${r}</span><span>${tip}</span></div>`;
          }
        });
        html += '</div></div>';
      }

      if (plan.bluff_targets && plan.bluff_targets.length > 0) {
        html += '<div class="preasta-section"><h4>Bluff Consigliati</h4><ul class="preasta-list">';
        plan.bluff_targets.forEach(b => {
          html += `<li><strong>${b.opponent}</strong>: ${b.strategy}</li>`;
        });
        html += '</ul></div>';
      }

      if (plan.general_tips && plan.general_tips.length > 0) {
        html += '<div class="preasta-section"><h4>Consigli Generali</h4><ul class="preasta-list">';
        plan.general_tips.forEach(t => {
          html += `<li>${t}</li>`;
        });
        html += '</ul></div>';
      }

      html += '<div class="preasta-actions"><button id="btn-regenerate-plan" class="btn btn-secondary btn-small">Rigenera Piano</button></div>';
      container.innerHTML = html;

      document.getElementById('btn-regenerate-plan').addEventListener('click', () => this.generatePreAstaPlan(true));
    } else {
      container.innerHTML = `
        <div class="preasta-empty">
          <p>Genera un piano strategico completo per la tua asta con <strong>1 singola chiamata AI</strong>.</p>
          <p class="preasta-tip">Consigliato farlo il giorno prima dell'asta per evitare di saturare le chiamate AI il giorno dell'asta.</p>
          <button id="btn-generate-plan" class="btn btn-primary">Genera Piano Pre-Asta</button>
        </div>
      `;
      document.getElementById('btn-generate-plan').addEventListener('click', () => this.generatePreAstaPlan(false));
    }
  },

  async generatePreAstaPlan(force) {
    if (force || !Store.getPreAstaPlan()) {
      if (!confirm('Generare il piano strategico pre-asta?\n\nConsigliato farlo il giorno prima dell\'asta per evitare di saturare le chiamate AI il giorno dell\'asta.')) return;
    }

    const container = document.getElementById('preasta-planner');
    const originalHtml = container.innerHTML;
    container.innerHTML = '<div class="preasta-loading">AI sta generando il piano strategico...</div>';

    try {
      await Advisor.getPreAstaPlan();
      this.renderPreAstaPlanner();
    } catch (err) {
      container.innerHTML = `<div class="preasta-error">Errore: ${err.message}</div><div style="margin-top:0.5rem"><button id="btn-retry-plan" class="btn btn-secondary btn-small">Riprova</button></div>`;
      document.getElementById('btn-retry-plan').addEventListener('click', () => this.generatePreAstaPlan(force));
    }
  },

  renderPlayerCompare() {
    const container = document.getElementById('player-compare');
    const players = Store.getPlayers();
    const auctioned = Store.getAuctionedPlayerIds();
    const log = Store.getAuctionLog();

    container.innerHTML = `
      <div class="compare-controls">
        <div class="form-group" style="position:relative">
          <label>Giocatore 1</label>
          <input type="text" id="cmp-search-1" placeholder="Cerca..." autocomplete="off">
          <div id="cmp-results-1" class="search-results hidden"></div>
        </div>
        <div class="form-group" style="position:relative">
          <label>Giocatore 2</label>
          <input type="text" id="cmp-search-2" placeholder="Cerca..." autocomplete="off">
          <div id="cmp-results-2" class="search-results hidden"></div>
        </div>
      </div>
      <div id="compare-table" class="hidden"></div>
    `;

    let player1 = null;
    let player2 = null;

    const getPlayerStatus = (name) => {
      if (!auctioned.has(name)) return { label: 'Disponibile', cls: 'available' };
      const entry = log.find(e => e.player === name);
      if (entry && entry.buyer) return { label: `Venduto a ${entry.buyer} (${entry.price}cr)`, cls: 'bought' };
      return { label: 'Svincolato', cls: 'missed' };
    };

    const getAvgPrice = (role) => {
      const sales = log.filter(e => e.role === role && e.price > 0);
      if (sales.length === 0) return null;
      return (sales.reduce((s, e) => s + e.price, 0) / sales.length).toFixed(1);
    };

    const renderTable = () => {
      if (!player1 || !player2) return;
      const s1 = getPlayerStatus(player1.Nome);
      const s2 = getPlayerStatus(player2.Nome);
      const avg1 = getAvgPrice(player1.R);
      const avg2 = getAvgPrice(player2.R);

      document.getElementById('compare-table').innerHTML = `
        <table class="compare-tbl">
          <thead>
            <tr>
              <th></th>
              <th>${player1.Nome}</th>
              <th>${player2.Nome}</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Ruolo</td><td>${player1.R}</td><td>${player2.R}</td></tr>
            <tr><td>Squadra</td><td>${player1.Squadra}</td><td>${player2.Squadra}</td></tr>
            <tr><td>Qt.A</td><td class="${player1.QtA < player2.QtA ? 'better' : player1.QtA > player2.QtA ? 'worse' : ''}">${player1.QtA}cr</td><td class="${player2.QtA < player1.QtA ? 'better' : player2.QtA > player1.QtA ? 'worse' : ''}">${player2.QtA}cr</td></tr>
            <tr><td>FVM</td><td class="${player1.FVM > player2.FVM ? 'better' : player1.FVM < player2.FVM ? 'worse' : ''}">${player1.FVM}</td><td class="${player2.FVM > player1.FVM ? 'better' : player2.FVM < player1.FVM ? 'worse' : ''}">${player2.FVM}</td></tr>
            <tr><td>Prezzo medio (${player1.R})</td><td>${avg1 ? avg1 + 'cr' : 'N/D'}</td><td>${avg2 ? avg2 + 'cr' : 'N/D'}</td></tr>
            <tr><td>Qualità/Prezzo</td><td>${avg1 ? (player1.FVM / avg1).toFixed(2) : 'N/D'}</td><td>${avg2 ? (player2.FVM / avg2).toFixed(2) : 'N/D'}</td></tr>
            <tr><td>Status</td><td><span class="w-status ${s1.cls}">${s1.label}</span></td><td><span class="w-status ${s2.cls}">${s2.label}</span></td></tr>
          </tbody>
        </table>
      `;
      document.getElementById('compare-table').classList.remove('hidden');
    };

    const bindSearch = (inputId, resultsId, setter) => {
      const input = document.getElementById(inputId);
      const results = document.getElementById(resultsId);
      input.addEventListener('input', () => {
        const query = input.value.trim();
        if (query.length < 2) { results.classList.add('hidden'); return; }
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
            if (player) {
              setter(player);
              input.value = player.Nome;
              renderTable();
            }
            results.classList.add('hidden');
          });
        });
      });
      input.addEventListener('blur', () => setTimeout(() => results.classList.add('hidden'), 200));
    };

    bindSearch('cmp-search-1', 'cmp-results-1', p => { player1 = p; });
    bindSearch('cmp-search-2', 'cmp-results-2', p => { player2 = p; });
  },

  renderLowCostFilter() {
    const container = document.getElementById('low-cost-filter');
    const players = Store.getPlayers();
    const auctioned = Store.getAuctionedPlayerIds();
    const config = Store.getConfig();

    if (!config || players.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted)">Carica il CSV delle quotazioni prima.</p>';
      return;
    }

    const threshold = parseInt(config.lcfThreshold) || 5;
    const available = players.filter(p => !auctioned.has(p.Nome) && p.QtA <= threshold);
    const roleLabels = { P: 'Portieri', D: 'Difensori', C: 'Centrocampisti', A: 'Attaccanti' };

    let html = `<div class="lcf-header">
      <span>Giocatori svincolati con Qt.A ≤ <input type="number" id="lcf-threshold" min="1" max="10" value="${threshold}" class="lcf-threshold-input"></span>
      <span class="lcf-count">${available.length} disponibili</span>
    </div>`;

    if (available.length === 0) {
      html += '<p style="color:var(--text-muted);font-size:0.85rem">Nessun giocatore trovato con questa soglia.</p>';
    } else {
      ['P', 'D', 'C', 'A'].forEach(r => {
        const rolePlayers = available.filter(p => p.R === r).sort((a, b) => b.FVM - a.FVM);
        if (rolePlayers.length === 0) return;
        html += `<div class="lcf-role">
          <div class="lcf-role-header">
            <span class="lcf-role-label lcf-color-${r}">${roleLabels[r]}</span>
            <span class="lcf-role-count">${rolePlayers.length}</span>
          </div>
          <div class="lcf-list">`;
        rolePlayers.forEach(p => {
          html += `<div class="lcf-item">
            <span class="lcf-name">${p.Nome}</span>
            <span class="lcf-team">${p.Squadra}</span>
            <span class="lcf-stats">QtA ${p.QtA} | FVM ${p.FVM}</span>
          </div>`;
        });
        html += '</div></div>';
      });
    }

    container.innerHTML = html;

    document.getElementById('lcf-threshold').addEventListener('change', (e) => {
      const val = parseInt(e.target.value) || 5;
      const cfg = Store.getConfig();
      if (cfg) {
        cfg.lcfThreshold = val;
        Store.saveConfig(cfg);
      }
      this.renderLowCostFilter();
    });
  },

  renderFormationField() {
    const container = document.getElementById('formation-field');
    const config = Store.getConfig();
    const teams = Store.getTeams();
    const roles = Store.getConfiguredRoles();
    const data = Store.getFormation();

    if (!config) {
      container.innerHTML = '<p style="color:var(--text-muted)">Configura la lega prima.</p>';
      return;
    }

    const myName = config.myName || '';
    const team = teams[myName] || { credits: config.credits, roster: { P: [], D: [], C: [], A: [] } };
    const allBought = [];
    ['P', 'D', 'C', 'A'].forEach(r => {
      (team.roster[r] || []).forEach(p => allBought.push({ ...p, R: r }));
    });

    const FORMATIONS = {
      '4-3-3': { P:1, D:4, C:3, A:3, positions: [
        {role:'P', x:50, y:90},
        {role:'D', x:15, y:72},{role:'D', x:38, y:72},{role:'D', x:62, y:72},{role:'D', x:85, y:72},
        {role:'C', x:25, y:50},{role:'C', x:50, y:50},{role:'C', x:75, y:50},
        {role:'A', x:20, y:25},{role:'A', x:50, y:25},{role:'A', x:80, y:25}
      ]},
      '4-4-2': { P:1, D:4, C:4, A:2, positions: [
        {role:'P', x:50, y:90},
        {role:'D', x:15, y:72},{role:'D', x:38, y:72},{role:'D', x:62, y:72},{role:'D', x:85, y:72},
        {role:'C', x:15, y:48},{role:'C', x:38, y:48},{role:'C', x:62, y:48},{role:'C', x:85, y:48},
        {role:'A', x:35, y:25},{role:'A', x:65, y:25}
      ]},
      '3-5-2': { P:1, D:3, C:5, A:2, positions: [
        {role:'P', x:50, y:90},
        {role:'D', x:25, y:72},{role:'D', x:50, y:72},{role:'D', x:75, y:72},
        {role:'C', x:10, y:50},{role:'C', x:30, y:48},{role:'C', x:50, y:45},{role:'C', x:70, y:48},{role:'C', x:90, y:50},
        {role:'A', x:35, y:25},{role:'A', x:65, y:25}
      ]},
      '3-4-3': { P:1, D:3, C:4, A:3, positions: [
        {role:'P', x:50, y:90},
        {role:'D', x:25, y:72},{role:'D', x:50, y:72},{role:'D', x:75, y:72},
        {role:'C', x:15, y:50},{role:'C', x:38, y:50},{role:'C', x:62, y:50},{role:'C', x:85, y:50},
        {role:'A', x:20, y:25},{role:'A', x:50, y:25},{role:'A', x:80, y:25}
      ]},
      '5-3-2': { P:1, D:5, C:3, A:2, positions: [
        {role:'P', x:50, y:90},
        {role:'D', x:10, y:72},{role:'D', x:30, y:72},{role:'D', x:50, y:72},{role:'D', x:70, y:72},{role:'D', x:90, y:72},
        {role:'C', x:25, y:48},{role:'C', x:50, y:48},{role:'C', x:75, y:48},
        {role:'A', x:35, y:25},{role:'A', x:65, y:25}
      ]},
      '5-4-1': { P:1, D:5, C:4, A:1, positions: [
        {role:'P', x:50, y:90},
        {role:'D', x:10, y:72},{role:'D', x:30, y:72},{role:'D', x:50, y:72},{role:'D', x:70, y:72},{role:'D', x:90, y:72},
        {role:'C', x:15, y:48},{role:'C', x:38, y:48},{role:'C', x:62, y:48},{role:'C', x:85, y:48},
        {role:'A', x:50, y:25}
      ]},
      '4-2-3-1': { P:1, D:4, C:2, A:1, cam:3, positions: [
        {role:'P', x:50, y:90},
        {role:'D', x:15, y:72},{role:'D', x:38, y:72},{role:'D', x:62, y:72},{role:'D', x:85, y:72},
        {role:'C', x:35, y:55},{role:'C', x:65, y:55},
        {role:'CAM', x:25, y:38},{role:'CAM', x:50, y:38},{role:'CAM', x:75, y:38},
        {role:'A', x:50, y:22}
      ]}
    };

    const module = data.module || '4-3-3';
    const fmt = FORMATIONS[module] || FORMATIONS['4-3-3'];

    const starters = [];
    const bench = [];
    const roleOrder = ['P', 'D', 'C', 'A'];
    roleOrder.forEach(r => {
      const players = allBought.filter(p => p.R === r).sort((a, b) => (b.FVM || 0) - (a.FVM || 0));
      const slots = fmt[r] || 0;
      players.forEach((p, i) => {
        if (i < slots) starters.push(p);
        else bench.push(p);
      });
    });

    let html = `<div class="ff-controls">
      <label class="ff-label">Modulo:</label>
      <select id="ff-module" class="ff-select">
        ${Object.keys(FORMATIONS).map(m => `<option value="${m}" ${m === module ? 'selected' : ''}>${m}</option>`).join('')}
      </select>
      <span class="ff-count">${starters.length} titolari | ${bench.length} panchina</span>
    </div>`;

    html += '<div class="ff-pitch">';
    html += '<div class="ff-pitch-lines"></div>';

    const nameMap = {};
    starters.forEach(p => { nameMap[p.R + '_' + p.Nome] = p; });

    fmt.positions.forEach((pos, i) => {
      let player = null;
      if (pos.role === 'CAM') {
        const cams = allBought.filter(p => p.R === 'C').sort((a, b) => (b.FVM || 0) - (a.FVM || 0));
        const usedC = starters.filter(p => p.R === 'C');
        player = cams.find(p => !usedC.includes(p)) || null;
      } else {
        const byRole = starters.filter(p => p.R === pos.role);
        const roleIdx = fmt.positions.slice(0, i).filter(p => p.role === pos.role).length;
        player = byRole[roleIdx] || null;
      }

      const roleColors = { P: '#60a5fa', D: '#34d399', C: '#fbbf24', A: '#f87171', CAM: '#c084fc' };
      const color = roleColors[pos.role] || '#888';
      const label = player ? player.Nome : pos.role;
      const sub = player ? `${player.Squadra || ''} FVM ${player.FVM || 0}` : 'Slot vuoto';

      html += `<div class="ff-player" style="left:${pos.x}%;top:${pos.y}%;border-color:${color}">
        <span class="ff-player-name">${label}</span>
        <span class="ff-player-sub">${sub}</span>
      </div>`;
    });
    html += '</div>';

    if (bench.length > 0) {
      html += '<div class="ff-bench"><h4>Panchina</h4><div class="ff-bench-list">';
      bench.forEach(p => {
        const roleColors = { P: '#60a5fa', D: '#34d399', C: '#fbbf24', A: '#f87171' };
        html += `<div class="ff-bench-item">
          <span class="ff-bench-role" style="color:${roleColors[p.R]}">${p.R}</span>
          <span class="ff-bench-name">${p.Nome}</span>
          <span class="ff-bench-team">${p.Squadra || ''}</span>
        </div>`;
      });
      html += '</div></div>';
    }

    container.innerHTML = html;

    document.getElementById('ff-module').addEventListener('change', (e) => {
      data.module = e.target.value;
      Store.saveFormation(data);
      this.renderFormationField();
    });
  },

  generateShareImage() {
    const canvas = document.getElementById('share-canvas');
    const ctx = canvas.getContext('2d');
    const config = Store.getConfig();
    const teams = Store.getTeams();
    const roles = Store.getConfiguredRoles();
    const myName = config ? config.myName : '';
    const team = teams[myName];
    if (!team) return;

    const w = 800;
    const h = 600;
    canvas.width = w;
    canvas.height = h;

    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#4f8cff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(config.leagueName || 'FantaAsta AI', 30, 40);

    ctx.fillStyle = '#8b8fa3';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Rosa di ${myName} — Crediti residui: ${team.credits}cr`, 30, 65);

    let y = 100;
    const roleLabels = { P: 'PORTIERI', D: 'DIFENSORI', C: 'CENTROCAMP', A: 'ATTACCANTI' };
    ['P', 'D', 'C', 'A'].forEach(r => {
      const players = team.roster[r] || [];
      const total = roles[r] || 0;
      ctx.fillStyle = '#4f8cff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`${roleLabels[r]} (${players.length}/${total})`, 30, y);
      y += 25;

      if (players.length === 0) {
        ctx.fillStyle = '#8b8fa3';
        ctx.font = '13px sans-serif';
        ctx.fillText('  Nessuno ancora', 30, y);
        y += 20;
      } else {
        players.forEach(p => {
          ctx.fillStyle = '#e4e6eb';
          ctx.font = '14px sans-serif';
          ctx.fillText(`  ${p.name}`, 30, y);
          ctx.fillStyle = '#8b8fa3';
          ctx.fillText(`${p.price}cr`, 250, y);
          y += 22;
        });
      }
      y += 10;
    });

    ctx.fillStyle = '#8b8fa3';
    ctx.font = '11px sans-serif';
    const date = new Date().toLocaleDateString('it-IT');
    ctx.fillText(`Generato da FantaAsta AI — ${date}`, 30, h - 15);

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fantaasta_rosa_${myName.replace(/\s+/g, '_')}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
};
