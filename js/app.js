const App = {
  init() {
    this.bindTabs();
    Config.init();
    Auction.init();
    Dashboard.init();
    this.bindSettings();
    this.refreshAll();
  },

  bindTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');

        if (btn.dataset.tab === 'dashboard') Dashboard.refresh();
        if (btn.dataset.tab === 'auction') Auction.refresh();
      });
    });
  },

  bindSettings() {
    document.getElementById('save-api-key').addEventListener('click', () => {
      const key = document.getElementById('api-key').value.trim();
      Store.saveApiKey(key);
      document.getElementById('api-key-status').textContent = key ? 'API Key salvata!' : 'API Key rimossa';
      document.getElementById('api-key-status').style.color = key ? 'var(--success)' : 'var(--text-muted)';
    });

    document.getElementById('toggle-api-visibility').addEventListener('click', () => {
      const input = document.getElementById('api-key');
      const btn = document.getElementById('toggle-api-visibility');
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = 'Nascondi';
      } else {
        input.type = 'password';
        btn.textContent = 'Mostra';
      }
    });

    document.getElementById('btn-export').addEventListener('click', () => {
      const json = Store.exportAll();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'fantaasta_stato_' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    document.getElementById('btn-import').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (Store.importAll(reader.result)) {
          alert('Stato importato con successo!');
          Config.loadSaved();
          this.refreshAll();
        } else {
          alert('Errore nell\'importazione del file.');
        }
      };
      reader.readAsText(file);
    });

    document.getElementById('btn-new-auction').addEventListener('click', () => {
      if (confirm('Sei sicuro di voler cancellare tutti i dati? Questa azione non può essere annullata.')) {
        Store.clearAll();
        location.reload();
      }
    });
  },

  refreshAll() {
    Auction.refresh();
    Dashboard.refresh();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
