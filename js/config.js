const Config = {
  pendingData: null,

  init() {
    this.bindRosterInputs();
    this.bindCsvUpload();
    this.bindParticipants();
    this.bindWishlist();
    this.bindSave();
    this.loadSaved();
  },

  bindRosterInputs() {
    const inputs = ['roster-p', 'roster-d', 'roster-c', 'roster-a'];
    const update = () => {
      const total = inputs.reduce((s, id) => s + (parseInt(document.getElementById(id).value) || 0), 0);
      document.getElementById('roster-total').textContent = `Totale: ${total} giocatori per rosa`;
    };
    inputs.forEach(id => document.getElementById(id).addEventListener('input', update));
    update();
  },

  bindCsvUpload() {
    const dropzone = document.getElementById('csv-dropzone');
    const fileInput = document.getElementById('csv-file');

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length) this.parseFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) this.parseFile(fileInput.files[0]);
    });

    document.getElementById('csv-confirm').addEventListener('click', () => this.confirmPending());
    document.getElementById('csv-remove').addEventListener('click', () => this.removeCsv());
  },

  parseFile(file) {
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      this.parseXlsx(file);
    } else {
      this.parseCsv(file);
    }
  },

  parseXlsx(file) {
    if (typeof XLSX === 'undefined') {
      alert('Libreria XLSX non caricata. Ricarica la pagina.');
      return;
    }
    file.arrayBuffer().then(buf => {
      try {
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (rows.length < 2) {
          alert('Il file XLSX sembra vuoto o non valido.');
          return;
        }
        this.pendingData = rows;
        this.showPreview(file.name, rows);
      } catch (err) {
        alert('Errore nel parsing del file XLSX: ' + err.message);
      }
    });
  },

  parseCsv(file) {
    Papa.parse(file, {
      delimiter: ';',
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data.length < 3) {
          alert('Il file CSV sembra vuoto o non valido.');
          return;
        }
        this.pendingData = results.data;
        this.showPreview(file.name, results.data);
      },
      error: (err) => {
        alert('Errore nel parsing del CSV: ' + err.message);
      }
    });
  },

  showPreview(filename, data) {
    document.getElementById('csv-dropzone').classList.add('hidden');
    document.getElementById('csv-info').classList.remove('hidden');
    document.getElementById('csv-filename').textContent = 'File: ' + filename;

    const headerRow = data[0];
    const totalPlayers = data.length - 2;
    document.getElementById('csv-count').textContent =
      `${totalPlayers} calciatori trovati | Colonne: ${headerRow.length}`;

    const preview = data.slice(0, 6);
    let html = '<table><thead><tr>';
    preview[0].forEach(h => { html += `<th>${h}</th>`; });
    html += '</tr></thead><tbody>';
    for (let i = 1; i < preview.length; i++) {
      html += '<tr>';
      preview[i].forEach(cell => { html += `<td>${cell}</td>`; });
      html += '</tr>';
    }
    html += '</tbody></table>';
    document.getElementById('csv-preview-table').innerHTML = html;
  },

  confirmPending() {
    if (!this.pendingData) return;
    const header = this.pendingData[0];

    const findCol = (name) => {
      const idx = header.findIndex(h => String(h).trim().toLowerCase() === name.toLowerCase());
      return idx >= 0 ? idx : null;
    };

    const colR   = findCol('R');
    const colRM  = findCol('RM');
    const colNome = findCol('Nome');
    const colSqd = findCol('Squadra');
    const colQtA = findCol('Qt.A');
    const colQtI = findCol('Qt.I');
    const colFVM = findCol('FVM');

    const fallback = { R: 1, RM: 2, Nome: 3, Squadra: 4, QtA: 5, QtI: 6, FVM: 11 };

    const c = {
      R:    colR    !== null ? colR    : fallback.R,
      RM:   colRM   !== null ? colRM   : fallback.RM,
      Nome: colNome !== null ? colNome : fallback.Nome,
      Squadra: colSqd !== null ? colSqd : fallback.Squadra,
      QtA:  colQtA  !== null ? colQtA  : fallback.QtA,
      QtI:  colQtI  !== null ? colQtI  : fallback.QtI,
      FVM:  colFVM  !== null ? colFVM  : fallback.FVM
    };

    const players = [];
    for (let i = 1; i < this.pendingData.length; i++) {
      const row = this.pendingData[i];
      if (!row || row.length < 5 || !row[c.Nome]) continue;
      if (String(row[c.R]).trim().toUpperCase() === 'R') continue;
      const roles = row[c.RM] ? String(row[c.RM]).replace(/"/g, '').split(';').map(r => r.trim()) : [];
      players.push({
        Id: row[0],
        R: row[c.R],
        RM: roles,
        Nome: String(row[c.Nome]).trim(),
        Squadra: String(row[c.Squadra]).trim(),
        QtA: parseInt(row[c.QtA]) || 0,
        QtI: parseInt(row[c.QtI]) || 0,
        FVM: parseInt(row[c.FVM]) || 0
      });
    }
    Store.savePlayers(players);
    this.pendingData = null;

    document.getElementById('csv-info').classList.add('hidden');
    document.getElementById('csv-loaded').classList.remove('hidden');
    document.getElementById('csv-loaded-info').textContent =
      `${players.length} calciatori salvati`;
  },

  removeCsv() {
    Store._remove('players');
    this.pendingData = null;
    document.getElementById('csv-dropzone').classList.remove('hidden');
    document.getElementById('csv-info').classList.add('hidden');
    document.getElementById('csv-loaded').classList.add('hidden');
  },

  bindParticipants() {
    document.getElementById('add-participant').addEventListener('click', () => {
      this.addParticipantRow();
    });

    document.getElementById('num-participants').addEventListener('change', (e) => {
      const target = parseInt(e.target.value) || 0;
      const tbody = document.getElementById('participants-body');
      const current = tbody.children.length;
      if (target > current) {
        for (let i = current; i < target; i++) {
          this.addParticipantRow();
        }
      }
    });
  },

  addParticipantRow(name = '', credits = null, isMe = false) {
    const config = Store.getConfig();
    const defaultCredits = config ? parseInt(config.credits) || 250 : 250;
    const tbody = document.getElementById('participants-body');
    const idx = tbody.children.length + 1;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx}</td>
      <td><input type="text" class="p-name" value="${name}" placeholder="Nome"></td>
      <td><input type="number" class="p-credits" min="1" value="${credits !== null ? credits : defaultCredits}"></td>
      <td class="flag-cell"><input type="radio" name="me-flag" class="p-me-flag" ${isMe ? 'checked' : ''}></td>
      <td><button class="btn btn-danger btn-small remove-participant">X</button></td>
    `;
    tr.querySelector('.remove-participant').addEventListener('click', () => {
      tr.remove();
      this.renumberParticipants();
    });
    tr.querySelector('.p-me-flag').addEventListener('change', () => {
      tbody.querySelectorAll('.p-me-flag').forEach(r => {
        if (r !== tr.querySelector('.p-me-flag')) r.checked = false;
      });
    });
    tbody.appendChild(tr);
  },

  renumberParticipants() {
    const rows = document.getElementById('participants-body').children;
    for (let i = 0; i < rows.length; i++) {
      rows[i].children[0].textContent = i + 1;
    }
  },

  getParticipantsFromTable() {
    const rows = document.getElementById('participants-body').children;
    const list = [];
    for (const row of rows) {
      const name = row.querySelector('.p-name').value.trim();
      const credits = parseInt(row.querySelector('.p-credits').value) || 250;
      const isMe = row.querySelector('.p-me-flag').checked;
      if (name) list.push({ name, credits, isMe });
    }
    return list;
  },

  bindWishlist() {
    const textarea = document.getElementById('wishlist-input');
    const suggestionsEl = document.getElementById('wishlist-suggestions');
    let activeIndex = -1;
    let matches = [];

    const updateCount = () => {
      const lines = textarea.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      document.getElementById('wishlist-count').textContent = `${lines.length} calciatori in wishlist`;
    };

    const getCurrentLine = () => {
      const pos = textarea.selectionStart;
      const text = textarea.value;
      const before = text.substring(0, pos);
      const lineStart = before.lastIndexOf('\n') + 1;
      return { text: before.substring(lineStart), start: lineStart, end: pos };
    };

    const insertAtLine = (name) => {
      const pos = textarea.selectionStart;
      const text = textarea.value;
      const before = text.substring(0, pos);
      const after = text.substring(pos);
      const lineStart = before.lastIndexOf('\n') + 1;
      const nlPos = after.indexOf('\n');
      const lineEnd = nlPos >= 0 ? pos + nlPos + 1 : text.length;
      const newBefore = text.substring(0, lineStart) + name;
      const newAfter = text.substring(lineEnd);
      textarea.value = newBefore + '\n' + newAfter;
      const newPos = newBefore.length + 1;
      textarea.selectionStart = newPos;
      textarea.selectionEnd = newPos;
      textarea.focus();
    };

    const showSuggestions = () => {
      const line = getCurrentLine();
      const query = line.text.trim().toLowerCase();
      if (query.length < 1) {
        suggestionsEl.classList.add('hidden');
        return;
      }

      const players = Store.getPlayers();
      const auctioned = Store.getAuctionedPlayerIds();
      const existingLines = textarea.value.split('\n').map(l => l.trim().toLowerCase());

      matches = players
        .filter(p => !auctioned.has(p.Nome) && p.Nome.toLowerCase().includes(query))
        .filter(p => !existingLines.includes(p.Nome.toLowerCase()))
        .slice(0, 8);

      if (matches.length === 0) {
        suggestionsEl.classList.add('hidden');
        return;
      }

      activeIndex = -1;
      suggestionsEl.innerHTML = matches.map((p, i) => `
        <div class="ws-item" data-idx="${i}">
          <span class="ws-name">${p.Nome}</span>
          <span class="ws-info">${p.R} | ${p.Squadra} | qt. ${p.QtA}</span>
        </div>
      `).join('');
      suggestionsEl.classList.remove('hidden');

      suggestionsEl.querySelectorAll('.ws-item').forEach(item => {
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const idx = parseInt(item.dataset.idx);
          insertAtLine(matches[idx].Nome);
          suggestionsEl.classList.add('hidden');
          updateCount();
        });
      });
    };

    const navigateSuggestions = (dir) => {
      const items = suggestionsEl.querySelectorAll('.ws-item');
      if (items.length === 0) return false;
      items.forEach(i => i.classList.remove('active'));
      activeIndex += dir;
      if (activeIndex < 0) activeIndex = items.length - 1;
      if (activeIndex >= items.length) activeIndex = 0;
      items[activeIndex].classList.add('active');
      return true;
    };

    const selectActive = () => {
      if (activeIndex >= 0 && activeIndex < matches.length) {
        insertAtLine(matches[activeIndex].Nome);
        suggestionsEl.classList.add('hidden');
        updateCount();
        return true;
      }
      return false;
    };

    textarea.addEventListener('input', () => {
      updateCount();
      showSuggestions();
    });

    textarea.addEventListener('keydown', (e) => {
      if (suggestionsEl.classList.contains('hidden')) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateSuggestions(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateSuggestions(-1);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        if (selectActive()) {
          e.preventDefault();
        }
      } else if (e.key === 'Escape') {
        suggestionsEl.classList.add('hidden');
      }
    });

    textarea.addEventListener('blur', () => {
      setTimeout(() => suggestionsEl.classList.add('hidden'), 150);
    });

    textarea.addEventListener('focus', () => {
      if (getCurrentLine().text.trim().length >= 1) showSuggestions();
    });

    updateCount();
  },

  getWishlistFromTextarea() {
    const lines = document.getElementById('wishlist-input').value
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);
    return lines.map((name, i) => ({ priority: i + 1, name }));
  },

  bindSave() {
    document.getElementById('save-config').addEventListener('click', () => this.saveAll());
  },

  saveAll() {
    const config = {
      leagueName: document.getElementById('league-name').value.trim(),
      numParticipants: parseInt(document.getElementById('num-participants').value) || 8,
      credits: parseInt(document.getElementById('credits').value) || 250,
      minBid: parseInt(document.getElementById('min-bid').value) || 1,
      rosterP: document.getElementById('roster-p').value,
      rosterD: document.getElementById('roster-d').value,
      rosterC: document.getElementById('roster-c').value,
      rosterA: document.getElementById('roster-a').value
    };

    const participants = this.getParticipantsFromTable();
    const wishlist = this.getWishlistFromTextarea();

    Store.saveConfig(config);
    Store.saveParticipants(participants);
    Store.saveWishlist(wishlist);

    const meParticipant = participants.find(p => p.isMe);
    config.myName = meParticipant ? meParticipant.name : '';
    Store.saveConfig(config);

    if (participants.length > 0) {
      Store.initTeamsFromParticipants(participants, config);
    }

    document.getElementById('header-info').textContent =
      `${config.leagueName || 'FantaAsta'} | ${participants.length} partecipanti | ${config.credits}cr | Rose: ${config.rosterP}P-${config.rosterD}D-${config.rosterC}C-${config.rosterA}A | Tu: ${config.myName || 'Non flaggato'}`;

    App.refreshAll();
    alert('Configurazione salvata!');
  },

  loadSaved() {
    const config = Store.getConfig();
    if (!config) return;

    document.getElementById('league-name').value = config.leagueName || '';
    document.getElementById('num-participants').value = config.numParticipants || 8;
    document.getElementById('credits').value = config.credits || 250;
    document.getElementById('min-bid').value = config.minBid || 1;
    document.getElementById('roster-p').value = config.rosterP || 3;
    document.getElementById('roster-d').value = config.rosterD || 8;
    document.getElementById('roster-c').value = config.rosterC || 8;
    document.getElementById('roster-a').value = config.rosterA || 6;

    const inputs = ['roster-p', 'roster-d', 'roster-c', 'roster-a'];
    const total = inputs.reduce((s, id) => s + (parseInt(document.getElementById(id).value) || 0), 0);
    document.getElementById('roster-total').textContent = `Totale: ${total} giocatori per rosa`;

    const participants = Store.getParticipants();
    if (participants.length > 0) {
      document.getElementById('participants-body').innerHTML = '';
      participants.forEach(p => this.addParticipantRow(p.name, p.credits, p.isMe || p.name === (config ? config.myName : '')));
    }

    const players = Store.getPlayers();
    if (players.length > 0) {
      document.getElementById('csv-dropzone').classList.add('hidden');
      document.getElementById('csv-loaded').classList.remove('hidden');
      document.getElementById('csv-loaded-info').textContent = `${players.length} calciatori salvati`;
    }

    const wishlist = Store.getWishlist();
    if (wishlist.length > 0) {
      document.getElementById('wishlist-input').value = wishlist.map(w => w.name).join('\n');
      document.getElementById('wishlist-count').textContent = `${wishlist.length} calciatori in wishlist`;
    }

    const apiKey = Store.getApiKey();
    if (apiKey) {
      document.getElementById('api-key').value = apiKey;
      document.getElementById('api-key-status').textContent = 'API Key salvata';
    }

    document.getElementById('header-info').textContent =
      `${config.leagueName || 'FantaAsta'} | ${participants.length} partecipanti | ${config.credits}cr | Rose: ${config.rosterP}P-${config.rosterD}D-${config.rosterC}C-${config.rosterA}A | Tu: ${config.myName || 'Non flaggato'}`;
  }
};
