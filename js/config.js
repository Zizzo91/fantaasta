const Config = {
  csvData: null,

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
      if (e.dataTransfer.files.length) this.parseCsv(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) this.parseCsv(fileInput.files[0]);
    });

    document.getElementById('csv-confirm').addEventListener('click', () => this.confirmCsv());
    document.getElementById('csv-remove').addEventListener('click', () => this.removeCsv());
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
        this.csvData = results.data;
        this.showCsvPreview(file.name, results.data);
      },
      error: (err) => {
        alert('Errore nel parsing del CSV: ' + err.message);
      }
    });
  },

  showCsvPreview(filename, data) {
    document.getElementById('csv-dropzone').classList.add('hidden');
    document.getElementById('csv-info').classList.remove('hidden');
    document.getElementById('csv-filename').textContent = 'File: ' + filename;

    const headerRow = data[0];
    const totalPlayers = data.length - 2;
    document.getElementById('csv-count').textContent =
      `${totalPlayers} calciatori trovati | Colonne: ${headerRow.length} | Separatore: ;`;

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

  confirmCsv() {
    if (!this.csvData) return;
    const header = this.csvData[0];
    const players = [];
    for (let i = 1; i < this.csvData.length; i++) {
      const row = this.csvData[i];
      if (row.length < 5 || !row[3]) continue;
      const roles = row[2] ? row[2].replace(/"/g, '').split(';').map(r => r.trim()) : [];
      players.push({
        Id: row[0],
        R: row[1],
        RM: roles,
        Nome: row[3],
        Squadra: row[4],
        QtA: parseInt(row[5]) || 0,
        QtI: parseInt(row[6]) || 0,
        FVM: parseInt(row[11]) || 0
      });
    }
    Store.savePlayers(players);
    this.csvData = null;

    document.getElementById('csv-info').classList.add('hidden');
    document.getElementById('csv-loaded').classList.remove('hidden');
    document.getElementById('csv-loaded-info').textContent =
      `${players.length} calciatori salvati`;
  },

  removeCsv() {
    Store._remove('players');
    this.csvData = null;
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
    const suggestions = document.getElementById('wishlist-suggestions');
    let activeIndex = -1;

    const updateCount = () => {
      const lines = textarea.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      document.getElementById('wishlist-count').textContent = `${lines.length} calciatori in wishlist`;
    };

    const getCurrentLine = () => {
      const val = textarea.value;
      const pos = textarea.selectionStart;
      const before = val.substring(0, pos);
      const lineStart = before.lastIndexOf('\n') + 1;
      return val.substring(lineStart, pos);
    };

    const replaceCurrentLine = (name) => {
      const val = textarea.value;
      const pos = textarea.selectionStart;
      const before = val.substring(0, pos);
      const after = val.substring(pos);
      const lineStart = before.lastIndexOf('\n') + 1;
      const afterNl = after.indexOf('\n');
      const rest = afterNl === -1 ? '' : after.substring(afterNl);
      textarea.value = val.substring(0, lineStart) + name + '\n' + rest;
      const newPos = lineStart + name.length + 1;
      textarea.selectionStart = textarea.selectionEnd = newPos;
      textarea.focus();
      updateCount();
    };

    const highlightMatch = (name, query) => {
      if (!query) return name;
      const idx = name.toLowerCase().indexOf(query.toLowerCase());
      if (idx === -1) return name;
      return name.substring(0, idx) + '<span class="sr-highlight">' + name.substring(idx, idx + query.length) + '</span>' + name.substring(idx + query.length);
    };

    const showSuggestions = (query) => {
      const matches = Store.searchPlayers(query);
      if (matches.length === 0) {
        suggestions.classList.add('hidden');
        return;
      }
      activeIndex = -1;
      suggestions.innerHTML = matches.map((p, i) => `
        <div class="search-result-item" data-name="${p.Nome}" data-idx="${i}">
          <span class="sr-name">${highlightMatch(p.Nome, query)}</span>
          <span class="sr-info">${p.R} | ${p.Squadra} | qt. ${p.QtA}</span>
        </div>
      `).join('');
      suggestions.classList.remove('hidden');

      suggestions.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          replaceCurrentLine(item.dataset.name);
          suggestions.classList.add('hidden');
        });
      });
    };

    const setActive = (idx) => {
      const items = suggestions.querySelectorAll('.search-result-item');
      items.forEach((el, i) => el.classList.toggle('active', i === idx));
      if (idx >= 0 && idx < items.length) {
        items[idx].scrollIntoView({ block: 'nearest' });
      }
    };

    textarea.addEventListener('input', () => {
      updateCount();
      const line = getCurrentLine();
      if (line.length >= 1 && Store.getPlayers().length > 0) {
        showSuggestions(line);
      } else {
        suggestions.classList.add('hidden');
      }
    });

    textarea.addEventListener('keydown', (e) => {
      if (suggestions.classList.contains('hidden')) return;
      const items = suggestions.querySelectorAll('.search-result-item');
      if (!items.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
        setActive(activeIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        setActive(activeIndex);
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        replaceCurrentLine(items[activeIndex].dataset.name);
        suggestions.classList.add('hidden');
      } else if (e.key === 'Escape') {
        suggestions.classList.add('hidden');
      }
    });

    textarea.addEventListener('blur', () => {
      setTimeout(() => suggestions.classList.add('hidden'), 150);
    });
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
