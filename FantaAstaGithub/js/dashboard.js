const Dashboard = {
  init() {},

  refresh() {
    const config = Store.getConfig();
    const participants = Store.getParticipants();
    const hasConfig = config && participants.length > 0;

    document.getElementById('dashboard-empty').classList.toggle('hidden', hasConfig);
    document.getElementById('dashboard-content').classList.toggle('hidden', !hasConfig);

    if (hasConfig) {
      this.renderMyRoster();
      this.renderCreditsRanking();
      this.renderMarketRemaining();
      this.renderWishlistStatus();
    }
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
            html += `<div style="font-size:0.78rem;color:var(--text-muted);margin-left:1.5rem;margin-top:0.2rem">`;
            html += team.roster[r].map(p => `${p.name} (${p.price}cr)`).join(', ');
            html += `</div>`;
          }
        });
      }
    });
    container.innerHTML = html;
  },

  renderCreditsRanking() {
    const teams = Store.getTeams();
    const participants = Store.getParticipants();
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
        <span class="bar-text">${count[r]} ${labels[r]}</span>
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
  }
};
