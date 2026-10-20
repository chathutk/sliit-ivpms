/**
 * IVPMS — Industry Visit Participant Management System
 * Core Application Engine & State Manager
 */

(function () {
  'use strict';

  // --- 1. STATE INITIALIZATION ---
  const STORAGE_KEY_MEMBERS = 'ivpms_members_v2';
  const STORAGE_KEY_VISITS = 'ivpms_visits_v2';
  const STORAGE_KEY_ACTIVE_VISIT = 'ivpms_active_visit_v2';
  const STORAGE_KEY_APPLICANTS = 'ivpms_applicants_v2';

  // Load from local storage or initial seed
  function getInitialMembers() {
    const saved = localStorage.getItem(STORAGE_KEY_MEMBERS);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    if (window.IVPMS_INITIAL_DATA && window.IVPMS_INITIAL_DATA.members) {
      return JSON.parse(JSON.stringify(window.IVPMS_INITIAL_DATA.members));
    }
    return [];
  }

  function getInitialVisits() {
    const saved = localStorage.getItem(STORAGE_KEY_VISITS);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    if (window.IVPMS_INITIAL_DATA && window.IVPMS_INITIAL_DATA.visits) {
      return JSON.parse(JSON.stringify(window.IVPMS_INITIAL_DATA.visits));
    }
    return [];
  }

  let state = {
    members: getInitialMembers(),
    visits: getInitialVisits(),
    activeVisit: {
      id: 'VIS-007',
      company: 'Zone24x7',
      date: '2026-09-25',
      capacity: 23,
      organisedBy: 'IEEE Student Branch & RAS',
      status: 'Shortlisting'
    },
    applicants: [], // Raw & enriched applicants
    selectedNics: new Set(),
    rsvpStatuses: {}, // nic -> 'Confirmed' | 'Pending' | 'Declined'
    attendedNics: new Set(),
    commsFormat: 'whatsapp', // 'whatsapp' | 'email'
    currentBlacklistCandidate: null
  };

  // Save State
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(state.members));
      localStorage.setItem(STORAGE_KEY_VISITS, JSON.stringify(state.visits));
      localStorage.setItem(STORAGE_KEY_ACTIVE_VISIT, JSON.stringify(state.activeVisit));
      localStorage.setItem(STORAGE_KEY_APPLICANTS, JSON.stringify(state.applicants));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
    updateKPIs();
  }

  // Toast Notification System
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✓' : 'ℹ';
    toast.innerHTML = `<span style="font-weight: bold; color: ${type === 'success' ? '#10b981' : '#ef4444'}">${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 200ms ease';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  // Update Global KPI Counters
  function updateKPIs() {
    const memEl = document.getElementById('kpi-members-count');
    const badgeEl = document.getElementById('badge-total-members');
    const visEl = document.getElementById('kpi-visits-count');
    const blEl = document.getElementById('kpi-blacklisted-count');

    if (memEl) memEl.textContent = state.members.length;
    if (badgeEl) badgeEl.textContent = state.members.length;
    if (visEl) visEl.textContent = state.visits.length;
    
    const blacklistedCount = state.members.filter(m => m.blacklisted).length;
    if (blEl) blEl.textContent = blacklistedCount;
  }

  // --- 2. TAB NAVIGATION ---
  function initNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const targetId = tab.getAttribute('data-tab');
        const pane = document.getElementById(targetId);
        if (pane) pane.classList.add('active');

        if (targetId === 'tab-roster') renderMasterRoster();
        if (targetId === 'tab-selection') renderSelectionEngine();
        if (targetId === 'tab-rsvp') renderRsvpManager();
        if (targetId === 'tab-comms') renderCommsGenerator();
        if (targetId === 'tab-visits-history') renderVisitsHistory();
      });
    });

    // Subtabs within selection view
    const subtabs = document.querySelectorAll('.sub-tab');
    subtabs.forEach(st => {
      st.addEventListener('click', () => {
        subtabs.forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.subtab-pane').forEach(p => p.classList.remove('active'));

        st.classList.add('active');
        const targetId = st.getAttribute('data-subtab');
        const pane = document.getElementById(targetId);
        if (pane) pane.classList.add('active');
      });
    });

    // Subtab Jump button
    const btnJumpRsvp = document.getElementById('btn-proceed-to-rsvp');
    if (btnJumpRsvp) {
      btnJumpRsvp.addEventListener('click', () => {
        const rsvpTab = document.querySelector('[data-tab="tab-rsvp"]');
        if (rsvpTab) rsvpTab.click();
      });
    }
  }

  // --- 3. MASTER ROSTER (TAB 1) ---
  function renderMasterRoster() {
    const tbody = document.getElementById('roster-tbody');
    if (!tbody) return;

    const searchTerm = (document.getElementById('roster-search')?.value || '').toLowerCase().trim();
    const companyFilter = document.getElementById('filter-company-visit')?.value || 'ALL';
    const memberFilter = document.getElementById('filter-membership')?.value || 'ALL';
    const visitFilter = document.getElementById('filter-visit-count')?.value || 'ALL';

    const filtered = state.members.filter(m => {
      // Search term
      if (searchTerm) {
        const matchSearch =
          (m.name || '').toLowerCase().includes(searchTerm) ||
          (m.nic || '').toLowerCase().includes(searchTerm) ||
          (m.ieeeNumber || '').toLowerCase().includes(searchTerm) ||
          (m.phone || '').toLowerCase().includes(searchTerm) ||
          (m.email || '').toLowerCase().includes(searchTerm);
        if (!matchSearch) return false;
      }

      // Company visit
      if (companyFilter !== 'ALL') {
        if (!m.visitsAttended || !m.visitsAttended.includes(companyFilter)) return false;
      }

      // Membership
      if (memberFilter === 'MEMBERS' && !m.ieeeNumber) return false;
      if (memberFilter === 'NON_MEMBERS' && m.ieeeNumber) return false;

      // Visit Count
      if (visitFilter !== 'ALL') {
        const count = m.totalVisits || (m.visitsAttended ? m.visitsAttended.length : 0);
        if (visitFilter === '0' && count !== 0) return false;
        if (visitFilter === '1' && count !== 1) return false;
        if (visitFilter === '2' && count !== 2) return false;
        if (visitFilter === '3+' && count < 3) return false;
      }

      return true;
    });

    const countEl = document.getElementById('roster-results-count');
    if (countEl) countEl.textContent = `Showing ${filtered.length} of ${state.members.length} members`;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No members match the current filter criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map((m, idx) => {
      const isBl = m.blacklisted;
      const count = m.totalVisits || (m.visitsAttended ? m.visitsAttended.length : 0);
      const bubbleClass = count === 0 ? 'visit-count-0' : count === 1 ? 'visit-count-1' : count === 2 ? 'visit-count-2' : 'visit-count-3plus';

      const chipsHtml = (m.visitsAttended && m.visitsAttended.length > 0)
        ? m.visitsAttended.map(c => `<span class="chip">${escapeHtml(c)}</span>`).join('')
        : '<span style="color: var(--text-muted); font-size: 0.75rem;">None</span>';

      const ieeeBadge = m.ieeeNumber
        ? `<span class="badge badge-emerald" title="IEEE Member: ${escapeHtml(m.ieeeNumber)}">${escapeHtml(m.ieeeNumber)}</span>`
        : `<span class="badge badge-subtle">No ID</span>`;

      return `
        <tr class="${isBl ? 'row-blacklisted' : ''}">
          <td style="color: var(--text-muted); font-family: monospace;">${idx + 1}</td>
          <td>
            <strong>${escapeHtml(m.name)}</strong>
            ${isBl ? `<span class="badge badge-danger" title="${escapeHtml(m.blacklistReason || 'Blacklisted')}">⚠️ ${escapeHtml(m.blacklistReason || 'Flagged')}</span>` : ''}
          </td>
          <td><code style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem;">${escapeHtml(m.nic)}</code></td>
          <td>${ieeeBadge}</td>
          <td>${escapeHtml(m.phone || '-')}</td>
          <td>${escapeHtml(m.email || '-')}</td>
          <td style="text-align: center;">
            <span class="visit-count-bubble ${bubbleClass}">${count}</span>
          </td>
          <td>
            <div class="company-chips-cell">${chipsHtml}</div>
          </td>
          <td style="text-align: center;">
            <button class="btn btn-ghost btn-sm ${isBl ? 'danger' : ''} btn-toggle-blacklist" data-nic="${escapeHtml(m.nic)}" title="Flag or Blacklist delegate">
              ${isBl ? 'Clear Flag' : 'Flag'}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach blacklist button events
    document.querySelectorAll('.btn-toggle-blacklist').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nic = e.currentTarget.getAttribute('data-nic');
        openBlacklistModal(nic);
      });
    });
  }

  // Clear search button logic
  const searchInput = document.getElementById('roster-search');
  const clearBtn = document.getElementById('roster-search-clear');
  if (searchInput && clearBtn) {
    searchInput.addEventListener('input', () => {
      clearBtn.classList.toggle('hidden', !searchInput.value);
      renderMasterRoster();
    });
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.classList.add('hidden');
      renderMasterRoster();
    });
  }

  document.querySelectorAll('#filter-company-visit, #filter-membership, #filter-visit-count').forEach(sel => {
    sel.addEventListener('change', renderMasterRoster);
  });

  // --- 4. BLACKLIST MODAL ---
  function openBlacklistModal(nic) {
    const member = state.members.find(m => m.nic === nic);
    if (!member) return;
    state.currentBlacklistCandidate = member;

    document.getElementById('blacklist-candidate-name').textContent = member.name;
    document.getElementById('blacklist-candidate-nic').textContent = member.nic;
    document.getElementById('blacklist-reason-input').value = member.blacklistReason || '';

    const btnRemove = document.getElementById('btn-remove-blacklist');
    if (btnRemove) {
      btnRemove.style.display = member.blacklisted ? 'inline-flex' : 'none';
    }

    const modal = document.getElementById('modal-blacklist');
    if (modal) modal.classList.remove('hidden');
  }

  document.getElementById('btn-save-blacklist')?.addEventListener('click', () => {
    if (!state.currentBlacklistCandidate) return;
    const reason = document.getElementById('blacklist-reason-input').value.trim() || 'Flagged by officer';
    state.currentBlacklistCandidate.blacklisted = true;
    state.currentBlacklistCandidate.blacklistReason = reason;
    saveState();
    closeAllModals();
    renderMasterRoster();
    renderSelectionEngine();
    showToast(`Flagged ${state.currentBlacklistCandidate.name} on review list.`);
  });

  document.getElementById('btn-remove-blacklist')?.addEventListener('click', () => {
    if (!state.currentBlacklistCandidate) return;
    state.currentBlacklistCandidate.blacklisted = false;
    state.currentBlacklistCandidate.blacklistReason = '';
    saveState();
    closeAllModals();
    renderMasterRoster();
    renderSelectionEngine();
    showToast(`Removed flag from ${state.currentBlacklistCandidate.name}.`);
  });

  // --- 5. ADD MEMBER MODAL ---
  document.getElementById('btn-add-member-modal')?.addEventListener('click', () => {
    document.getElementById('modal-add-member')?.classList.remove('hidden');
  });

  document.getElementById('form-add-member')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('new-member-name').value.trim();
    const nic = document.getElementById('new-member-nic').value.trim();
    const ieee = document.getElementById('new-member-ieee').value.trim();
    const phone = document.getElementById('new-member-phone').value.trim();
    const email = document.getElementById('new-member-email').value.trim();

    if (!name || !nic) {
      showToast('Name and NIC are required', 'error');
      return;
    }

    const existing = state.members.find(m => m.nic.toLowerCase() === nic.toLowerCase());
    if (existing) {
      showToast(`Member with NIC ${nic} already exists in Main roster!`, 'error');
      return;
    }

    const newMember = {
      id: `MEM-${state.members.length + 1}`,
      name,
      nic,
      ieeeNumber: ieee || '',
      phone: phone || '',
      email: email || '',
      visitsAttended: [],
      totalVisits: 0,
      blacklisted: false,
      blacklistReason: ''
    };

    state.members.push(newMember);
    saveState();
    closeAllModals();
    renderMasterRoster();
    showToast(`Added ${name} to Main database.`);
    e.target.reset();
  });

  // --- 6. REGISTER VISIT MODAL ---
  document.getElementById('btn-register-visit-modal')?.addEventListener('click', () => {
    document.getElementById('modal-register-visit')?.classList.remove('hidden');
  });

  document.getElementById('form-register-visit')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const company = document.getElementById('new-visit-company').value.trim();
    const date = document.getElementById('new-visit-date').value;
    const capacity = parseInt(document.getElementById('new-visit-capacity').value, 10) || 25;
    const org = document.getElementById('new-visit-org').value.trim();

    state.activeVisit = {
      id: `VIS-${state.visits.length + 1}`,
      company,
      date,
      capacity,
      organisedBy: org,
      status: 'Shortlisting'
    };

    // Reset current selection
    state.applicants = [];
    state.selectedNics.clear();
    state.rsvpStatuses = {};
    state.attendedNics.clear();

    saveState();
    closeAllModals();
    
    // Switch to selection tab
    const selTab = document.querySelector('[data-tab="tab-selection"]');
    if (selTab) selTab.click();

    showToast(`Registered new visit: ${company}`);
    e.target.reset();
  });

  // Modal Closers
  function closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
    state.currentBlacklistCandidate = null;
  }

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  document.querySelectorAll('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAllModals();
    });
  });

  // --- 7. VISIT & SELECTION ENGINE (TAB 2) ---
  function renderSelectionEngine() {
    // Update banner metadata
    const visit = state.activeVisit;
    document.getElementById('current-visit-company').textContent = `${visit.company} Industry Visit`;
    document.getElementById('current-visit-date').textContent = visit.date;
    document.getElementById('current-visit-org').textContent = visit.organisedBy;
    document.getElementById('current-visit-capacity').textContent = visit.capacity;
    document.getElementById('target-capacity').textContent = visit.capacity;
    document.getElementById('selected-count').textContent = state.selectedNics.size;

    const fillPercent = Math.min(100, Math.round((state.selectedNics.size / visit.capacity) * 100));
    const meterFill = document.getElementById('capacity-meter-fill');
    if (meterFill) {
      meterFill.style.width = `${fillPercent}%`;
      meterFill.style.background = fillPercent >= 100
        ? 'linear-gradient(90deg, #10b981, #34d399)'
        : 'linear-gradient(90deg, #6366f1, #38bdf8)';
    }

    const autoBtn = document.getElementById('btn-auto-select-top');
    if (autoBtn) autoBtn.textContent = `Auto-Select Top ${visit.capacity}`;

    // Categorize applicants
    const selectedList = [];
    const reserveList = [];
    const allRankedList = [];
    const unmatchedList = [];

    // Filter applicants by search if provided
    const candSearch = (document.getElementById('candidate-search')?.value || '').toLowerCase().trim();

    state.applicants.forEach((app, idx) => {
      const isSelected = state.selectedNics.has(app.nic);
      
      if (candSearch) {
        const matches = app.name.toLowerCase().includes(candSearch) || app.nic.toLowerCase().includes(candSearch);
        if (!matches) return;
      }

      allRankedList.push({ app, rank: idx + 1, isSelected });

      if (app.unmatched) {
        unmatchedList.push(app);
      }

      if (isSelected) {
        selectedList.push({ app, rank: selectedList.length + 1 });
      } else if (!app.unmatched && (app.isMember || app.totalVisits <= 2)) {
        reserveList.push({ app, order: reserveList.length + 1 });
      }
    });

    // Update subtab badges
    document.getElementById('count-badge-selected').textContent = selectedList.length;
    document.getElementById('count-badge-reserve').textContent = reserveList.length;
    document.getElementById('count-badge-all').textContent = state.applicants.length;
    document.getElementById('count-badge-unmatched').textContent = unmatchedList.length;

    // Render Subtabs
    renderSelectedSubtab(selectedList);
    renderReserveSubtab(reserveList);
    renderAllRankedSubtab(allRankedList);
    renderUnmatchedSubtab(unmatchedList);
  }

  function renderSelectedSubtab(list) {
    const tbody = document.getElementById('tbody-selected');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">No candidates selected yet. Use "Auto-Select Top ${state.activeVisit.capacity}" or tick individual checkboxes.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(({ app, rank }) => {
      const isBl = app.blacklisted;
      const confBadge = getConfirmationBadge(app.confirmationNote);
      return `
        <tr class="${isBl ? 'row-blacklisted' : ''}">
          <td>
            <input type="checkbox" class="select-checkbox cand-checkbox" checked data-nic="${escapeHtml(app.nic)}">
          </td>
          <td style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--emerald-400);">${rank}</td>
          <td>
            <strong>${escapeHtml(app.name)}</strong>
            ${isBl ? `<span class="badge badge-danger">⚠️ ${escapeHtml(app.blacklistReason || 'Flagged')}</span>` : ''}
          </td>
          <td><code style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem;">${escapeHtml(app.nic)}</code></td>
          <td>${getMemberBadge(app)}</td>
          <td style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(app.year || '-')} • ${escapeHtml(app.degree || '-')}</td>
          <td style="text-align: center;">
            <span class="visit-count-bubble visit-count-${Math.min(3, app.totalVisits)}">${app.totalVisits}</span>
          </td>
          <td><span class="badge ${app.dietary === 'Veg' ? 'badge-amber' : 'badge-subtle'}">${escapeHtml(app.dietary || 'Non-Veg')}</span></td>
          <td>
            <span class="badge badge-emerald">Selected</span>
            ${confBadge}
          </td>
        </tr>
      `;
    }).join('');

    attachCheckboxEvents();
  }

  function renderReserveSubtab(list) {
    const tbody = document.getElementById('tbody-reserve');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">Reserve pool is currently empty.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(({ app, order }) => {
      const isBl = app.blacklisted;
      const confBadge = getConfirmationBadge(app.confirmationNote);
      return `
        <tr class="${isBl ? 'row-blacklisted' : ''}">
          <td>
            <input type="checkbox" class="select-checkbox cand-checkbox" data-nic="${escapeHtml(app.nic)}">
          </td>
          <td style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--indigo-400);">#${order}</td>
          <td>
            <strong>${escapeHtml(app.name)}</strong>
            ${isBl ? `<span class="badge badge-danger">⚠️ Flagged</span>` : ''}
          </td>
          <td><code style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem;">${escapeHtml(app.nic)}</code></td>
          <td>${getMemberBadge(app)}</td>
          <td style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(app.year || '-')} • ${escapeHtml(app.degree || '-')}</td>
          <td style="text-align: center;">
            <span class="visit-count-bubble visit-count-${Math.min(3, app.totalVisits)}">${app.totalVisits}</span>
          </td>
          <td><span class="badge ${app.dietary === 'Veg' ? 'badge-amber' : 'badge-subtle'}">${escapeHtml(app.dietary || 'Non-Veg')}</span></td>
          <td>
            ${confBadge}
            <button class="btn btn-secondary btn-sm btn-quick-promote" data-nic="${escapeHtml(app.nic)}">
              Promote to Selected
            </button>
          </td>
        </tr>
      `;
    }).join('');

    attachCheckboxEvents();
    document.querySelectorAll('.btn-quick-promote').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nic = e.currentTarget.getAttribute('data-nic');
        state.selectedNics.add(nic);
        renderSelectionEngine();
        showToast('Promoted candidate to selected list.');
      });
    });
  }

  function renderAllRankedSubtab(list) {
    const tbody = document.getElementById('tbody-all-ranked');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No applicants loaded. Upload a form responses sheet or click "Load Zone24x7 115 Applicants (Demo)".</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(({ app, rank, isSelected }) => {
      const tierLabel = isSelected
        ? '<span class="badge badge-emerald">Selected</span>'
        : (rank <= state.activeVisit.capacity + 15 && app.isMember)
        ? '<span class="badge badge-indigo">Reserve</span>'
        : '<span class="badge badge-subtle">Below Cut</span>';
      const confBadge = getConfirmationBadge(app.confirmationNote);

      return `
        <tr>
          <td>
            <input type="checkbox" class="select-checkbox cand-checkbox" ${isSelected ? 'checked' : ''} data-nic="${escapeHtml(app.nic)}">
          </td>
          <td style="font-family: 'JetBrains Mono', monospace; color: var(--text-muted);">${rank}</td>
          <td><strong>${escapeHtml(app.name)}</strong></td>
          <td><code style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem;">${escapeHtml(app.nic)}</code></td>
          <td>${getMemberBadge(app)}</td>
          <td style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(app.year || '-')} • ${escapeHtml(app.degree || '-')}</td>
          <td style="text-align: center;">
            <span class="visit-count-bubble visit-count-${Math.min(3, app.totalVisits)}">${app.totalVisits}</span>
          </td>
          <td><span class="badge ${app.dietary === 'Veg' ? 'badge-amber' : 'badge-subtle'}">${escapeHtml(app.dietary || 'Non-Veg')}</span></td>
          <td>
            ${tierLabel}
            ${confBadge}
          </td>
        </tr>
      `;
    }).join('');

    attachCheckboxEvents();
  }

  function getConfirmationBadge(note) {
    if (!note) return '';
    const lower = note.toLowerCase();
    if (lower.includes('confirmed') || lower.includes('yes')) {
      return `<span class="badge badge-emerald" title="RSVP: ${escapeHtml(note)}">✓ ${escapeHtml(note)}</span>`;
    }
    if (lower.includes('not comming') || lower.includes('unable to attend') || lower.includes('unable to attemd')) {
      return `<span class="badge badge-danger" title="RSVP: ${escapeHtml(note)}">✗ ${escapeHtml(note)}</span>`;
    }
    if (lower.includes('no answer')) {
      return `<span class="badge badge-amber" title="RSVP: ${escapeHtml(note)}">⏳ ${escapeHtml(note)}</span>`;
    }
    return `<span class="badge badge-subtle" title="RSVP: ${escapeHtml(note)}">${escapeHtml(note)}</span>`;
  }

  function renderUnmatchedSubtab(list) {
    const tbody = document.getElementById('tbody-unmatched');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--emerald-400);">✓ All candidates cleanly matched with the Main database! Zero review items.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(app => `
      <tr>
        <td><strong>${escapeHtml(app.name)}</strong></td>
        <td><code>${escapeHtml(app.nic)}</code></td>
        <td>${escapeHtml(app.ieeeNumber || 'Blank / Missing')}</td>
        <td>${escapeHtml(app.phone || '-')}</td>
        <td>${escapeHtml(app.email || '-')}</td>
        <td>
          <button class="btn btn-secondary btn-sm btn-resolve-unmatched" data-nic="${escapeHtml(app.nic)}">
            Link to Main Member
          </button>
        </td>
      </tr>
    `).join('');

    document.querySelectorAll('.btn-resolve-unmatched').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nic = e.currentTarget.getAttribute('data-nic');
        const app = state.applicants.find(a => a.nic === nic);
        if (!app) return;
        const entered = prompt(`Enter verified IEEE Membership Number for ${app.name}:`, app.ieeeNumber || '');
        if (entered !== null) {
          app.ieeeNumber = entered.trim();
          app.isMember = entered.trim().length > 0;
          app.unmatched = false;
          sortApplicants();
          renderSelectionEngine();
          showToast(`Verified membership for ${app.name}`);
        }
      });
    });
  }

  function getMemberBadge(app) {
    if (app.isRas) return `<span class="badge badge-emerald" title="RAS Volunteer / Member">RAS Member</span>`;
    if (app.isMember) return `<span class="badge badge-indigo" title="IEEE Member: ${escapeHtml(app.ieeeNumber)}">IEEE Member</span>`;
    return `<span class="badge badge-subtle">Non-Member</span>`;
  }

  function attachCheckboxEvents() {
    document.querySelectorAll('.cand-checkbox').forEach(box => {
      box.addEventListener('change', (e) => {
        const nic = e.currentTarget.getAttribute('data-nic');
        if (e.currentTarget.checked) {
          state.selectedNics.add(nic);
        } else {
          state.selectedNics.delete(nic);
        }
        renderSelectionEngine();
      });
    });
  }

  // Auto-Select Top N Button
  document.getElementById('btn-auto-select-top')?.addEventListener('click', () => {
    state.selectedNics.clear();
    const capacity = state.activeVisit.capacity;
    
    // Pick first N eligible candidates
    let count = 0;
    for (const app of state.applicants) {
      if (count >= capacity) break;
      if (!app.blacklisted && !app.unmatched) {
        state.selectedNics.add(app.nic);
        count++;
      }
    }

    renderSelectionEngine();
    showToast(`Auto-selected top ${count} candidates by IEEE priority & fewest visits.`);
  });

  // Candidate Search
  document.getElementById('candidate-search')?.addEventListener('input', () => {
    renderSelectionEngine();
  });

  // --- 8. FILE INGESTION & MATCHING ENGINE ---
  function ingestFormResponses(rawRows) {
    if (!rawRows || rawRows.length === 0) {
      showToast('Empty spreadsheet uploaded', 'error');
      return;
    }

    // Heuristic column detection
    const headers = Object.keys(rawRows[0] || {});
    function findKey(keywords) {
      return headers.find(h => {
        const lower = h.toLowerCase();
        return keywords.some(k => lower.includes(k));
      });
    }

    const nameKey = findKey(['full name', 'name', 'applicant', 'student name']) || headers[0];
    const nicKey = findKey(['nic', 'identity', 'national id']) || headers[1];
    const ieeeKey = findKey(['membership number', 'ieee no', 'member number', 'ieee']);
    const phoneKey = findKey(['phone', 'whatsapp', 'mobile', 'contact']);
    const emailKey = findKey(['email', 'mail']);
    const degreeKey = findKey(['degree', 'course', 'program', 'specialization']);
    const yearKey = findKey(['year', 'academic year', 'level']);
    const dietKey = findKey(['diet', 'food', 'preference', 'vegetarian']);
    const timeKey = findKey(['timestamp', 'time', 'date applied']);

    const confirmKey = findKey(['confirm']);
    const confirmationKey = findKey(['confirmation', 'rsvp note']);

    // Build fast lookup by NIC and by IEEE Number from Main Database
    const mainByNic = new Map();
    const mainByIeee = new Map();
    state.members.forEach(m => {
      if (m.nic) mainByNic.set(m.nic.toLowerCase().trim(), m);
      if (m.ieeeNumber) mainByIeee.set(m.ieeeNumber.toLowerCase().trim(), m);
    });

    const parsed = [];
    rawRows.forEach((row, i) => {
      const rawName = String(row[nameKey] || '').trim();
      let rawNic = String(row[nicKey] || '').trim();
      if (rawNic.endsWith('.0')) rawNic = rawNic.slice(0, -2);
      if (!rawName || !rawNic) return;

      let rawIeee = ieeeKey ? String(row[ieeeKey] || '').trim() : '';
      if (rawIeee.endsWith('.0')) rawIeee = rawIeee.slice(0, -2);

      let rawPhone = phoneKey ? String(row[phoneKey] || '').trim() : '';
      if (rawPhone.endsWith('.0')) rawPhone = rawPhone.slice(0, -2);
      if (rawPhone && !rawPhone.startsWith('0') && rawPhone.length === 9) rawPhone = '0' + rawPhone;

      const rawEmail = emailKey ? String(row[emailKey] || '').trim() : '';
      const rawDegree = degreeKey ? String(row[degreeKey] || '').trim() : '';
      const rawYear = yearKey ? String(row[yearKey] || '').trim() : '';
      const rawDiet = dietKey ? String(row[dietKey] || '').trim() : 'Non-Veg';
      const rawTime = timeKey ? String(row[timeKey] || '') : `${i}`;
      const rawConfirm = confirmKey ? String(row[confirmKey] || '').trim() : (row.confirm || '');
      const rawConfirmationNote = confirmationKey ? String(row[confirmationKey] || '').trim() : (row.confirmationNote || '');

      const foodNorm = (rawDiet.toLowerCase().includes('veg') && !rawDiet.toLowerCase().includes('non')) ? 'Veg' : 'Non-Veg';

      // Live matching against Main
      const matchedByNic = mainByNic.get(rawNic.toLowerCase());
      const matchedByIeee = rawIeee ? mainByIeee.get(rawIeee.toLowerCase()) : null;
      const matchedMember = matchedByNic || matchedByIeee;

      const isMember = Boolean(matchedMember?.ieeeNumber || (rawIeee && rawIeee !== 'None' && rawIeee.length > 5));
      const verifiedIeee = matchedMember?.ieeeNumber || rawIeee;
      const totalVisits = matchedMember ? (matchedMember.totalVisits || (matchedMember.visitsAttended ? matchedMember.visitsAttended.length : 0)) : 0;
      const isBlacklisted = matchedMember ? matchedMember.blacklisted : false;
      const blacklistReason = matchedMember ? matchedMember.blacklistReason : '';

      // Check unmatched warning
      const unmatched = Boolean(rawIeee && !matchedMember && rawIeee.length > 5);

      // Map RSVP status from CSV confirmation if present
      let initialRsvp = 'Pending';
      const noteLower = rawConfirmationNote.toLowerCase();
      if (noteLower.includes('not comming') || noteLower.includes('unable to attend') || noteLower.includes('unable to attemd')) {
        initialRsvp = 'Declined';
      } else if (noteLower.includes('confirmed') || noteLower.includes('yes') || rawConfirm.toUpperCase() === 'TRUE') {
        initialRsvp = 'Confirmed';
      }
      state.rsvpStatuses[rawNic] = initialRsvp;

      parsed.push({
        id: `APP-${i + 1}`,
        name: rawName,
        nic: rawNic,
        ieeeNumber: verifiedIeee,
        isMember,
        phone: rawPhone || matchedMember?.phone || '',
        email: rawEmail || matchedMember?.email || '',
        degree: rawDegree,
        year: rawYear,
        dietary: foodNorm,
        timestamp: rawTime,
        confirm: rawConfirm,
        confirmationNote: rawConfirmationNote,
        totalVisits,
        blacklisted: isBlacklisted,
        blacklistReason,
        unmatched
      });
    });

    state.applicants = parsed;
    sortApplicants();

    // Reset selection and auto select
    state.selectedNics.clear();
    let count = 0;
    for (const app of state.applicants) {
      if (count >= state.activeVisit.capacity) break;
      if (!app.blacklisted && !app.unmatched) {
        state.selectedNics.add(app.nic);
        count++;
      }
    }

    saveState();
    renderSelectionEngine();
    showToast(`Successfully ingested and ranked ${parsed.length} applicants!`);
  }

  function sortApplicants() {
    // Ranking hierarchy:
    // 1. IEEE Members first
    // 2. Fewest Total Prior Visits (ascending: 0, 1, 2...)
    // 3. Application timestamp (submission order)
    state.applicants.sort((a, b) => {
      // Priority 1: Membership
      if (a.isMember && !b.isMember) return -1;
      if (!a.isMember && b.isMember) return 1;

      // Priority 2: Prior visits attended
      if (a.totalVisits !== b.totalVisits) {
        return a.totalVisits - b.totalVisits;
      }

      // Priority 3: Timestamp
      return a.timestamp.localeCompare(b.timestamp);
    });
  }

  // Load Zone24x7 Demo Applicants Button
  document.getElementById('btn-load-demo-responses')?.addEventListener('click', () => {
    if (window.IVPMS_INITIAL_DATA && window.IVPMS_INITIAL_DATA.sampleApplicants) {
      ingestFormResponses(window.IVPMS_INITIAL_DATA.sampleApplicants);
    } else {
      showToast('Sample applicant data unavailable', 'error');
    }
  });

  // Dropzone drag and drop
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('form-upload-input');
  const dropzoneTrigger = document.getElementById('dropzone-trigger');

  if (dropzoneTrigger && fileInput) {
    dropzoneTrigger.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleUploadedFile(file);
    });
  }

  if (dropzone) {
    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) handleUploadedFile(files[0]);
    });
  }

  function handleUploadedFile(file) {
    showToast(`Parsing ${file.name}...`);
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);
        ingestFormResponses(rows);
      } catch (err) {
        console.error(err);
        showToast('Error reading spreadsheet file. Please check format.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // --- 9. RSVP & POST-VISIT ATTENDANCE (TAB 3) ---
  function renderRsvpManager() {
    const tbody = document.getElementById('tbody-rsvp');
    if (!tbody) return;

    // Candidates in selected list
    const selected = state.applicants.filter(a => state.selectedNics.has(a.nic));

    // Stats
    let confCount = 0;
    let pendCount = 0;
    let declCount = 0;
    let attCount = 0;

    selected.forEach(a => {
      const status = state.rsvpStatuses[a.nic] || 'Pending';
      if (status === 'Confirmed') confCount++;
      else if (status === 'Declined') declCount++;
      else pendCount++;

      if (state.attendedNics.has(a.nic)) attCount++;
    });

    document.getElementById('rsvp-confirmed-count').textContent = confCount;
    document.getElementById('rsvp-pending-count').textContent = pendCount;
    document.getElementById('rsvp-declined-count').textContent = declCount;
    document.getElementById('rsvp-attended-count').textContent = attCount;

    if (selected.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No candidates selected yet. Please complete shortlisting on the "Visit & Selection Engine" tab first.</td></tr>`;
      return;
    }

    tbody.innerHTML = selected.map((app, idx) => {
      const currentRsvp = state.rsvpStatuses[app.nic] || 'Pending';
      const isAttended = state.attendedNics.has(app.nic);

      const rsvpSelect = `
        <select class="status-pill-select status-${currentRsvp.toLowerCase()} rsvp-select" data-nic="${escapeHtml(app.nic)}">
          <option value="Confirmed" ${currentRsvp === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="Pending" ${currentRsvp === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="Declined" ${currentRsvp === 'Declined' ? 'selected' : ''}>Declined</option>
        </select>
      `;

      const promoteBtn = currentRsvp === 'Declined'
        ? `<button class="btn btn-secondary btn-sm btn-auto-promote-reserve" data-nic="${escapeHtml(app.nic)}">Promote #1 Reserve &rarr;</button>`
        : '<span style="color: var(--text-muted); font-size: 0.8rem;">Active</span>';

      return `
        <tr>
          <td style="font-family: 'JetBrains Mono', monospace; color: var(--text-muted);">${idx + 1}</td>
          <td><strong>${escapeHtml(app.name)}</strong></td>
          <td>${escapeHtml(app.phone || '-')}</td>
          <td>${escapeHtml(app.email || '-')}</td>
          <td>${rsvpSelect}</td>
          <td style="text-align: center;">
            <input type="checkbox" class="select-checkbox attend-checkbox" ${isAttended ? 'checked' : ''} data-nic="${escapeHtml(app.nic)}">
          </td>
          <td>${promoteBtn}</td>
        </tr>
      `;
    }).join('');

    // Attach RSVP change listener
    document.querySelectorAll('.rsvp-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const nic = e.currentTarget.getAttribute('data-nic');
        state.rsvpStatuses[nic] = e.currentTarget.value;
        renderRsvpManager();
      });
    });

    // Attach Attend checkbox listener
    document.querySelectorAll('.attend-checkbox').forEach(box => {
      box.addEventListener('change', (e) => {
        const nic = e.currentTarget.getAttribute('data-nic');
        if (e.currentTarget.checked) state.attendedNics.add(nic);
        else state.attendedNics.delete(nic);
        renderRsvpManager();
      });
    });

    // Auto promote listener
    document.querySelectorAll('.btn-auto-promote-reserve').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const declinedNic = e.currentTarget.getAttribute('data-nic');
        // Find first reserve candidate
        const topReserve = state.applicants.find(a => !state.selectedNics.has(a.nic) && !a.blacklisted && !a.unmatched);
        if (topReserve) {
          state.selectedNics.delete(declinedNic);
          state.selectedNics.add(topReserve.nic);
          state.rsvpStatuses[topReserve.nic] = 'Pending';
          renderRsvpManager();
          renderSelectionEngine();
          showToast(`Promoted ${topReserve.name} from Reserve to replace declined applicant.`);
        } else {
          showToast('No eligible reserve candidates available.', 'error');
        }
      });
    });
  }

  // Commit Attendance to Main Roster
  document.getElementById('btn-commit-attendance')?.addEventListener('click', () => {
    if (state.attendedNics.size === 0) {
      showToast('No attendees checked yet. Tick "Mark Attended" for attendees first.', 'error');
      return;
    }

    if (!confirm(`Are you sure you want to commit attendance for ${state.attendedNics.size} delegates to the Main database for ${state.activeVisit.company}?`)) {
      return;
    }

    const company = state.activeVisit.company;
    let newEnrolled = 0;
    let updatedCount = 0;

    state.attendedNics.forEach(nic => {
      let member = state.members.find(m => m.nic.toLowerCase() === nic.toLowerCase());
      if (member) {
        if (!member.visitsAttended) member.visitsAttended = [];
        if (!member.visitsAttended.includes(company)) {
          member.visitsAttended.push(company);
          member.totalVisits = member.visitsAttended.length;
          updatedCount++;
        }
      } else {
        // Enrol new member on confirmed attendance
        const app = state.applicants.find(a => a.nic === nic);
        if (app) {
          state.members.push({
            id: `MEM-${state.members.length + 1}`,
            name: app.name,
            nic: app.nic,
            ieeeNumber: app.ieeeNumber || '',
            phone: app.phone || '',
            email: app.email || '',
            visitsAttended: [company],
            totalVisits: 1,
            blacklisted: false,
            blacklistReason: ''
          });
          newEnrolled++;
        }
      }
    });

    state.activeVisit.status = 'Completed';
    saveState();
    renderRsvpManager();
    renderMasterRoster();
    showToast(`✓ Attendance locked! Updated ${updatedCount} members, enrolled ${newEnrolled} new members into Main.`);
  });

  // --- 10. COMMS GENERATOR (TAB 4) ---
  function renderCommsGenerator() {
    const candidateSelect = document.getElementById('comms-candidate-select');
    if (!candidateSelect) return;

    const selected = state.applicants.filter(a => state.selectedNics.has(a.nic));

    // Populate candidate dropdown
    candidateSelect.innerHTML = selected.map(app => `
      <option value="${escapeHtml(app.nic)}">${escapeHtml(app.name)} (${escapeHtml(app.phone || 'No phone')})</option>
    `).join('');

    // Headcounts
    const vegCount = selected.filter(a => a.dietary === 'Veg').length;
    const nonVegCount = selected.length - vegCount;
    document.getElementById('comms-veg-count').textContent = vegCount;
    document.getElementById('comms-nonveg-count').textContent = nonVegCount;

    // Bulk phones
    const phoneList = selected.map(a => a.phone).filter(Boolean);
    const bulkBox = document.getElementById('comms-bulk-phones');
    if (bulkBox) bulkBox.value = phoneList.join(', ');

    updateCommsPreview();
  }

  function updateCommsPreview() {
    const previewBox = document.getElementById('preview-text-box');
    const candSelect = document.getElementById('comms-candidate-select');
    if (!previewBox) return;

    const nic = candSelect?.value;
    const candidate = state.applicants.find(a => a.nic === nic) || { name: '[Name]', phone: '' };

    const date = document.getElementById('comms-date')?.value || '[DATE]';
    const time = document.getElementById('comms-time')?.value || '[TIME]';
    const location = document.getElementById('comms-location')?.value || '[LOCATION]';
    const deadline = document.getElementById('comms-deadline')?.value || '[DEADLINE]';
    const grouplink = document.getElementById('comms-grouplink')?.value || '[GROUP LINK]';
    const company = state.activeVisit.company;

    let text = '';
    if (state.commsFormat === 'whatsapp') {
      text = `Hi ${candidate.name},

Congratulations! You've been confirmed for the IEEE Student Branch of SLIIT industry visit to ${company} on ${date}.

Reporting Time: ${time}
Reporting Point: ${location}

Please join the official WhatsApp group using the link below. All further details (transport, agenda, and dress code) will be shared there only:
${grouplink}

Kindly join by ${deadline}. Slots are limited and we maintain an active reserve list; if we don't see you in the group by then, we will offer your place to the next applicant in rank order.

If you are no longer able to attend, please reply to let us know immediately so another member can take the slot.

See you there!
IEEE Student Branch of SLIIT`;
    } else {
      text = `Subject: Confirmed — ${company} Industry Visit | IEEE Student Branch of SLIIT

Dear ${candidate.name},

Congratulations! We are pleased to confirm your place on the upcoming industry visit to ${company}, organised by the IEEE Student Branch of SLIIT.

Date: ${date}
Reporting Time: ${time}
Reporting Point: ${location}

We received a high number of applications for a limited number of slots, so please treat this confirmation as a firm commitment.

Next Step: Join the Official WhatsApp Coordination Group
All further logistics will happen in the WhatsApp group. Please join using the link below by ${deadline}:
${grouplink}

Transport arrangements, the agenda, dress code, and last-minute updates will be shared in the group only, so joining is required to participate.

If you are unable to attend, please reply to this email as soon as possible so we can offer your slot to an applicant on the reserve list.

We look forward to seeing you there.

Best regards,
Chathumina Tharushan Kalatuwage
Chairperson, IEEE Student Branch of SLIIT
chathumina@ieee.org`;
    }

    previewBox.textContent = text;

    // WhatsApp web link
    const waLink = document.getElementById('btn-send-whatsapp-web');
    if (waLink) {
      let cleanPhone = (candidate.phone || '').replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = '94' + cleanPhone.slice(1);
      waLink.href = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}` : '#';
      waLink.style.display = cleanPhone ? 'inline-flex' : 'none';
    }
  }

  // Comms format tabs
  document.querySelectorAll('.preview-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.commsFormat = tab.getAttribute('data-format');
      updateCommsPreview();
    });
  });

  document.querySelectorAll('#comms-date, #comms-time, #comms-location, #comms-deadline, #comms-grouplink, #comms-candidate-select').forEach(el => {
    el.addEventListener('input', updateCommsPreview);
    el.addEventListener('change', updateCommsPreview);
  });

  // Copy Message Text Button
  document.getElementById('btn-copy-message')?.addEventListener('click', () => {
    const text = document.getElementById('preview-text-box')?.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied personalized message to clipboard!');
    });
  });

  // Copy Bulk Phones Button
  document.getElementById('btn-copy-bulk-phones')?.addEventListener('click', () => {
    const text = document.getElementById('comms-bulk-phones')?.value || '';
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied all candidate WhatsApp numbers to clipboard!');
    });
  });

  // --- 11. VISITS ARCHIVE (TAB 5) ---
  function renderVisitsHistory() {
    const container = document.getElementById('visits-archive-grid');
    if (!container) return;

    const companies = ['Atlas Labs', 'WSO2', 'Codegen', 'Orange', 'Rootcode', 'IFS', 'Zone24x7', 'Cambio'];
    
    container.innerHTML = companies.map(comp => {
      const attendees = state.members.filter(m => m.visitsAttended && m.visitsAttended.includes(comp));
      return `
        <div class="visit-archive-card">
          <div class="visit-card-top">
            <span class="badge badge-emerald">Completed</span>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; font-weight: 700; color: var(--emerald-400);">${attendees.length} Attendees</span>
          </div>
          <h4 class="visit-card-name">${escapeHtml(comp)}</h4>
          <div class="visit-card-meta">
            <span>IEEE Student Branch of SLIIT</span>
            <span>Recorded in Master Tracking Sheet</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- 12. EXCEL EXPORT FUNCTIONS ---
  // Export All Members
  document.getElementById('btn-export-all-members')?.addEventListener('click', () => {
    showToast('Exporting Master Database to Excel...');
    const companies = ['Atlas Labs', 'WSO2', 'Codegen', 'Orange', 'Rootcode', 'IFS', 'Zone24x7', 'Cambio'];

    const exportData = state.members.map((m, idx) => {
      const row = {
        '#': idx + 1,
        'Full Name': m.name,
        'NIC': m.nic,
        'IEEE Membership Number': m.ieeeNumber || '',
        'Phone Number': m.phone || '',
        'Email Address': m.email || '',
        'Total Visits Count': m.totalVisits || (m.visitsAttended ? m.visitsAttended.length : 0),
      };
      companies.forEach(c => {
        row[c] = (m.visitsAttended && m.visitsAttended.includes(c)) ? 'Y' : '';
      });
      row['Blacklisted'] = m.blacklisted ? 'YES' : 'NO';
      row['Blacklist Reason'] = m.blacklistReason || '';
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'All Members');
    XLSX.writeFile(workbook, `IEEE_SLIIT_Member_Tracking_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Export complete!');
  });

  // Export Shortlist
  document.getElementById('btn-export-shortlist')?.addEventListener('click', () => {
    const selected = state.applicants.filter(a => state.selectedNics.has(a.nic));
    if (selected.length === 0) {
      showToast('No candidates selected to export.', 'error');
      return;
    }

    const exportData = selected.map((a, idx) => ({
      '#': idx + 1,
      'Full Name': a.name,
      'NIC': a.nic,
      'IEEE Membership #': a.ieeeNumber || '',
      'Phone Number': a.phone || '',
      'Email Address': a.email || '',
      'Degree Program': a.degree || '',
      'Year of Study': a.year || '',
      'Dietary Preference': a.dietary || 'Non-Veg',
      'RSVP Status': state.rsvpStatuses[a.nic] || 'Pending'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Final Selected');
    XLSX.writeFile(workbook, `${state.activeVisit.company}_Industry_Visit_Confirmed_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast(`Exported ${selected.length} delegates for ${state.activeVisit.company}!`);
  });

  // Helper Escape HTML
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- BOOTSTRAP ---
  document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    updateKPIs();
    renderMasterRoster();

    // Auto-load Zone24x7 demo applicants if available so the user sees live data immediately
    if (window.IVPMS_INITIAL_DATA && window.IVPMS_INITIAL_DATA.sampleApplicants) {
      ingestFormResponses(window.IVPMS_INITIAL_DATA.sampleApplicants);
    }
  });

})();
