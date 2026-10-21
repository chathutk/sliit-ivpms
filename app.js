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
  const STORAGE_KEY_VISIT_ROSTERS = 'ivpms_visit_rosters_v2';
  const STORAGE_KEY_RSVP = 'ivpms_rsvp_v2';
  const STORAGE_KEY_ATTENDED = 'ivpms_attended_v2';
  const STORAGE_KEY_SELECTED = 'ivpms_selected_v2';

  // Load from local storage or initial seed
  function getInitialMembers() {
    let members = [];
    const saved = localStorage.getItem(STORAGE_KEY_MEMBERS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) members = parsed;
      } catch (e) {
        console.error('Failed to parse saved members:', e);
      }
    }
    const seedMembers = (window.IVPMS_INITIAL_DATA && window.IVPMS_INITIAL_DATA.members) || [];
    if (members.length === 0) {
      members = JSON.parse(JSON.stringify(seedMembers));
    } else if (seedMembers.length > 0) {
      // Non-destructively merge missing members from seed (e.g. Lion Brewery members MEM-251 to MEM-263)
      const existingNics = new Set(members.map(m => (m.nic || '').trim().toLowerCase()).filter(Boolean));
      let added = false;
      seedMembers.forEach(sm => {
        const nicKey = (sm.nic || '').trim().toLowerCase();
        if (nicKey && !existingNics.has(nicKey)) {
          members.push(JSON.parse(JSON.stringify(sm)));
          existingNics.add(nicKey);
          added = true;
        }
      });
      if (added) {
        try { localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(members)); } catch (e) {}
      }
    }
    return members;
  }

  function getInitialVisits() {
    let visits = [];
    const saved = localStorage.getItem(STORAGE_KEY_VISITS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) visits = parsed;
      } catch (e) {
        console.error('Failed to parse saved visits:', e);
      }
    }
    const seedVisits = (window.IVPMS_INITIAL_DATA && window.IVPMS_INITIAL_DATA.visits) || [];
    if (visits.length === 0) {
      visits = JSON.parse(JSON.stringify(seedVisits));
    } else if (seedVisits.length > 0) {
      // Non-destructively merge missing visits from seed (e.g. VIS-009 Lion Brewery)
      const existingIds = new Set(visits.map(v => v.id));
      const existingNames = new Set(visits.map(v => (v.company || '').trim().toLowerCase()).filter(Boolean));
      let added = false;
      seedVisits.forEach(sv => {
        const nameKey = (sv.company || '').trim().toLowerCase();
        if (!existingIds.has(sv.id) && !existingNames.has(nameKey)) {
          visits.push(JSON.parse(JSON.stringify(sv)));
          existingIds.add(sv.id);
          existingNames.add(nameKey);
          added = true;
        }
      });
      if (added) {
        try { localStorage.setItem(STORAGE_KEY_VISITS, JSON.stringify(visits)); } catch (e) {}
      }
    }
    return visits;
  }

  function getInitialRosters() {
    const saved = localStorage.getItem(STORAGE_KEY_VISIT_ROSTERS);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return {};
  }

  function getInitialApplicants() {
    const saved = localStorage.getItem(STORAGE_KEY_APPLICANTS);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return [];
  }

  function getInitialRsvpStatuses() {
    const saved = localStorage.getItem(STORAGE_KEY_RSVP);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return {};
  }

  function getInitialAttendedNics() {
    const saved = localStorage.getItem(STORAGE_KEY_ATTENDED);
    if (saved) {
      try { return new Set(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
    return new Set();
  }

  function getInitialSelectedNics() {
    const saved = localStorage.getItem(STORAGE_KEY_SELECTED);
    if (saved) {
      try { return new Set(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
    return new Set();
  }

  function getInitialActiveVisit() {
    const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_VISIT);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return {
      id: 'VIS-007',
      company: 'Zone24x7',
      date: '2026-09-25',
      capacity: 23,
      organisedBy: 'IEEE Student Branch & RAS',
      status: 'Shortlisting'
    };
  }

  let state = {
    members: getInitialMembers(),
    visits: getInitialVisits(),
    visitRosters: getInitialRosters(), // temporary visit database
    activeVisit: getInitialActiveVisit(),
    applicants: getInitialApplicants(), // Raw & enriched applicants
    selectedNics: getInitialSelectedNics(),
    rsvpStatuses: getInitialRsvpStatuses(), // nic -> 'Confirmed' | 'Pending' | 'Declined'
    attendedNics: getInitialAttendedNics(),
    commsFormat: 'whatsapp', // 'whatsapp' | 'email'
    currentBlacklistCandidate: null,
    modalActiveVisitId: null,
    modalFilterStatus: 'ALL',
    modalSearchQuery: ''
  };

  // Save State
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(state.members));
      localStorage.setItem(STORAGE_KEY_VISITS, JSON.stringify(state.visits));
      localStorage.setItem(STORAGE_KEY_ACTIVE_VISIT, JSON.stringify(state.activeVisit));
      localStorage.setItem(STORAGE_KEY_APPLICANTS, JSON.stringify(state.applicants));
      localStorage.setItem(STORAGE_KEY_VISIT_ROSTERS, JSON.stringify(state.visitRosters));
      localStorage.setItem(STORAGE_KEY_RSVP, JSON.stringify(state.rsvpStatuses));
      localStorage.setItem(STORAGE_KEY_ATTENDED, JSON.stringify(Array.from(state.attendedNics)));
      localStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify(Array.from(state.selectedNics)));
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

  // Synchronize visits from members (e.g. any attended company like Lion Brewery automatically gets registered)
  function syncVisitsFromMembers() {
    let changed = false;
    const companyStats = {};
    state.members.forEach(m => {
      if (Array.isArray(m.visitsAttended)) {
        m.visitsAttended.forEach(c => {
          if (c && c.trim()) {
            const comp = c.trim();
            if (!companyStats[comp]) {
              companyStats[comp] = { count: 0, originalName: comp };
            }
            companyStats[comp].count++;
          }
        });
      }
    });

    Object.keys(companyStats).forEach(comp => {
      const stats = companyStats[comp];
      let existing = state.visits.find(v => (v.company || '').trim().toLowerCase() === comp.toLowerCase());
      if (!existing) {
        const newId = `VIS-${String(state.visits.length + 1).padStart(3, '0')}`;
        existing = {
          id: newId,
          company: stats.originalName,
          date: '2026-10-15',
          capacity: stats.count,
          organisedBy: 'IEEE Student Branch',
          status: 'Completed',
          attendeeCount: stats.count
        };
        state.visits.push(existing);
        changed = true;
      } else {
        if (existing.status === 'Completed' && existing.attendeeCount !== stats.count) {
          existing.attendeeCount = stats.count;
          changed = true;
        }
        if (stats.count > (existing.capacity || 0)) {
          existing.capacity = stats.count;
          changed = true;
        }
      }
    });

    if (changed) {
      saveState();
    }
  }

  // Dynamically populate company filter dropdown with live attendee counts
  function populateCompanyFilterDropdown() {
    const sel = document.getElementById('filter-company-visit');
    if (!sel) return;

    const currentVal = sel.value || 'ALL';

    const companyCounts = {};
    state.members.forEach(m => {
      if (Array.isArray(m.visitsAttended)) {
        m.visitsAttended.forEach(c => {
          if (c && c.trim()) {
            const name = c.trim();
            companyCounts[name] = (companyCounts[name] || 0) + 1;
          }
        });
      }
    });

    state.visits.forEach(v => {
      if (v.company && companyCounts[v.company] === undefined) {
        companyCounts[v.company] = 0;
      }
    });

    const orderedCompanies = [];
    const seen = new Set();
    state.visits.forEach(v => {
      if (v.company && !seen.has(v.company)) {
        seen.add(v.company);
        orderedCompanies.push(v.company);
      }
    });
    Object.keys(companyCounts).forEach(c => {
      if (!seen.has(c)) {
        seen.add(c);
        orderedCompanies.push(c);
      }
    });

    let html = '<option value="ALL">All Visits</option>';
    orderedCompanies.forEach(comp => {
      const count = companyCounts[comp] || 0;
      html += `<option value="${escapeHtml(comp)}">${escapeHtml(comp)} (${count})</option>`;
    });

    sel.innerHTML = html;

    if (Array.from(sel.options).some(o => o.value === currentVal)) {
      sel.value = currentVal;
    } else {
      sel.value = 'ALL';
    }
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

    const filterCompanyEl = document.getElementById('filter-company-visit');
    if (filterCompanyEl && filterCompanyEl.options.length <= 1) {
      populateCompanyFilterDropdown();
    }

    const searchTerm = (document.getElementById('roster-search')?.value || '').toLowerCase().trim();
    const companyFilter = filterCompanyEl?.value || 'ALL';
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
    syncVisitsFromMembers();
    saveState();
    populateCompanyFilterDropdown();
    closeAllModals();
    renderMasterRoster();
    showToast(`Added ${name} to Main database.`);
    e.target.reset();
  });

  document.querySelectorAll('#btn-register-visit-modal, #btn-history-register-visit').forEach(btn => {
    btn?.addEventListener('click', () => {
      document.getElementById('modal-register-visit')?.classList.remove('hidden');
    });
  });

  document.getElementById('form-register-visit')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const company = document.getElementById('new-visit-company').value.trim();
    const date = document.getElementById('new-visit-date').value;
    const capacity = parseInt(document.getElementById('new-visit-capacity').value, 10) || 25;
    const org = document.getElementById('new-visit-org').value.trim();

    const newVisit = {
      id: `VIS-${String(state.visits.length + 1).padStart(3, '0')}`,
      company,
      date,
      capacity,
      organisedBy: org,
      status: 'Shortlisting'
    };

    state.visits.push(newVisit);
    state.activeVisit = newVisit;

    // Reset current selection
    state.applicants = [];
    state.selectedNics.clear();
    state.rsvpStatuses = {};
    state.attendedNics.clear();

    saveState();
    populateCompanyFilterDropdown();
    closeAllModals();
    
    // Switch to selection tab
    const selTab = document.querySelector('[data-tab="tab-selection"]');
    if (selTab) selTab.click();

    showToast(`Registered new visit: ${company}`);
    renderVisitsHistory();
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
    const visitRecord = state.visits.find(v => v.id === state.activeVisit.id || v.company.toLowerCase() === company.toLowerCase());
    if (visitRecord) {
      visitRecord.status = 'Completed';
      visitRecord.attendeeCount = state.attendedNics.size;
    }
    if (state.visitRosters[state.activeVisit.id]) {
      state.visitRosters[state.activeVisit.id].status = 'Completed';
      state.visitRosters[state.activeVisit.id].participants.forEach(p => {
        p.attended = state.attendedNics.has(p.nic);
      });
    }

    syncVisitsFromMembers();
    saveState();
    populateCompanyFilterDropdown();
    renderRsvpManager();
    renderMasterRoster();
    renderVisitsHistory();
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

  // --- 11. TEMPORARY VISIT DATABASE & ROSTER ENGINE ---
  function saveCurrentRosterToVisitDb() {
    const selected = state.applicants.filter(a => state.selectedNics.has(a.nic));
    if (selected.length === 0) {
      showToast('No candidates selected to save. Please select candidates first.', 'error');
      return;
    }

    const visitId = state.activeVisit.id || `VIS-${String(state.visits.length + 1).padStart(3, '0')}`;
    const participants = selected.map((app, idx) => ({
      id: app.id || `PART-${idx + 1}`,
      name: app.name,
      nic: app.nic,
      ieeeNumber: app.ieeeNumber || '',
      isMember: app.isMember || false,
      phone: app.phone || '',
      email: app.email || '',
      degree: app.degree || '',
      year: app.year || '',
      dietary: app.dietary || 'Non-Veg',
      rsvpStatus: state.rsvpStatuses[app.nic] || 'Pending',
      attended: state.attendedNics.has(app.nic),
      notes: app.confirmationNote || ''
    }));

    // Ensure activeVisit is recorded in state.visits
    let visitRecord = state.visits.find(v => v.id === visitId || v.company.toLowerCase() === state.activeVisit.company.toLowerCase());
    if (!visitRecord) {
      visitRecord = {
        id: visitId,
        company: state.activeVisit.company,
        date: state.activeVisit.date,
        capacity: state.activeVisit.capacity,
        organisedBy: state.activeVisit.organisedBy,
        status: 'Roster Saved'
      };
      state.visits.push(visitRecord);
    } else {
      visitRecord.status = 'Roster Saved';
      visitRecord.capacity = state.activeVisit.capacity;
      visitRecord.date = state.activeVisit.date;
      visitRecord.organisedBy = state.activeVisit.organisedBy;
    }

    state.activeVisit.status = 'Roster Saved';

    // Store in temporary database (Main member database remains completely untouched!)
    state.visitRosters[visitId] = {
      visitId: visitId,
      company: state.activeVisit.company,
      date: state.activeVisit.date,
      capacity: state.activeVisit.capacity,
      organisedBy: state.activeVisit.organisedBy,
      status: 'Roster Saved',
      participants: participants,
      lastSaved: new Date().toISOString()
    };

    saveState();

    const confCount = participants.filter(p => p.rsvpStatus === 'Confirmed').length;
    showToast(`✓ Temporary roster for ${state.activeVisit.company} (${participants.length} delegates, ${confCount} confirmed) saved to Visit Database. Main DB untouched!`);

    renderVisitsHistory();
    renderRsvpManager();
  }

  function getVisitRosterById(visitId) {
    if (state.visitRosters && state.visitRosters[visitId]) {
      return state.visitRosters[visitId];
    }

    // Find visit metadata
    const visit = state.visits.find(v => v.id === visitId) || (state.activeVisit && state.activeVisit.id === visitId ? state.activeVisit : null);
    if (!visit) return null;

    // Check if this matches active visit with selected applicants
    if (state.activeVisit && state.activeVisit.id === visitId && state.selectedNics.size > 0) {
      const selected = state.applicants.filter(a => state.selectedNics.has(a.nic));
      return {
        visitId: visit.id,
        company: visit.company,
        date: visit.date,
        capacity: visit.capacity,
        organisedBy: visit.organisedBy,
        status: visit.status || 'Shortlisting',
        participants: selected.map((app, idx) => ({
          id: app.id || `PART-${idx + 1}`,
          name: app.name,
          nic: app.nic,
          ieeeNumber: app.ieeeNumber || '',
          isMember: app.isMember || false,
          phone: app.phone || '',
          email: app.email || '',
          degree: app.degree || '',
          year: app.year || '',
          dietary: app.dietary || 'Non-Veg',
          rsvpStatus: state.rsvpStatuses[app.nic] || 'Pending',
          attended: state.attendedNics.has(app.nic),
          notes: app.confirmationNote || ''
        })),
        lastSaved: null
      };
    }

    // Historical completed visits recorded in state.members
    const attendees = state.members.filter(m => m.visitsAttended && m.visitsAttended.includes(visit.company));
    if (attendees.length > 0) {
      return {
        visitId: visit.id,
        company: visit.company,
        date: visit.date,
        capacity: visit.capacity || attendees.length,
        organisedBy: visit.organisedBy || 'IEEE Student Branch',
        status: 'Completed',
        isHistorical: true,
        participants: attendees.map((m, idx) => ({
          id: `HIST-${m.id || idx + 1}`,
          name: m.name,
          nic: m.nic,
          ieeeNumber: m.ieeeNumber || '',
          isMember: Boolean(m.ieeeNumber && m.ieeeNumber.length > 5),
          phone: m.phone || '',
          email: m.email || '',
          degree: m.degree || 'Computing',
          year: m.year || '3rd Year',
          dietary: m.dietary || 'Non-Veg',
          rsvpStatus: 'Confirmed',
          attended: true,
          notes: 'Master Database Recorded Attendee'
        })),
        lastSaved: visit.date
      };
    }

    return {
      visitId: visit.id,
      company: visit.company,
      date: visit.date,
      capacity: visit.capacity,
      organisedBy: visit.organisedBy,
      status: visit.status || 'Planning',
      participants: [],
      lastSaved: null
    };
  }

  // --- 12. VISITS ARCHIVE & TEMPORARY ROSTER CARDS (TAB 5) ---
  function renderVisitsHistory() {
    const container = document.getElementById('visits-archive-grid');
    if (!container) return;

    let visitsList = [...state.visits];
    
    // Sort: upcoming / roster-saved first, then chronological
    visitsList.sort((a, b) => {
      const isSavedA = Boolean(state.visitRosters[a.id]);
      const isSavedB = Boolean(state.visitRosters[b.id]);
      if (isSavedA && !isSavedB) return -1;
      if (!isSavedA && isSavedB) return 1;
      return (b.date || '').localeCompare(a.date || '');
    });

    // Search filter
    const searchVal = (document.getElementById('history-search-input')?.value || '').toLowerCase().trim();
    if (searchVal) {
      visitsList = visitsList.filter(v => 
        (v.company && v.company.toLowerCase().includes(searchVal)) || 
        (v.organisedBy && v.organisedBy.toLowerCase().includes(searchVal)) ||
        (v.date && v.date.includes(searchVal))
      );
    }

    // Status filter
    const statusVal = document.getElementById('history-filter-status')?.value || 'ALL';
    if (statusVal === 'ROSTER_SAVED') {
      visitsList = visitsList.filter(v => Boolean(state.visitRosters[v.id]) || v.status === 'Roster Saved');
    } else if (statusVal === 'COMPLETED') {
      visitsList = visitsList.filter(v => v.status === 'Completed');
    }

    if (visitsList.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
          No industry visits found matching your filters.
        </div>
      `;
      return;
    }

    container.innerHTML = visitsList.map(v => {
      const roster = getVisitRosterById(v.id);
      const parts = roster ? roster.participants : [];
      const totalParts = parts.length;
      const confParts = parts.filter(p => p.rsvpStatus === 'Confirmed').length;
      const attParts = parts.filter(p => p.attended).length;

      const hasTempDb = Boolean(state.visitRosters[v.id]);

      let badgeHtml = '';
      if (v.status === 'Completed') {
        badgeHtml = `<span class="badge badge-emerald">Completed</span>`;
      } else if (hasTempDb || v.status === 'Roster Saved') {
        badgeHtml = `<span class="badge badge-indigo">Pre-Visit Roster</span>`;
      } else {
        badgeHtml = `<span class="badge badge-amber">Shortlisting</span>`;
      }

      const dbTag = hasTempDb 
        ? `<span style="font-size: 0.75rem; color: #818cf8; display: flex; align-items: center; gap: 0.3rem;">⚡ Temporary Visit DB (${totalParts} delegates)</span>`
        : (v.status === 'Completed' 
            ? `<span style="font-size: 0.75rem; color: var(--emerald-400); display: flex; align-items: center; gap: 0.3rem;">✓ Main Database Verified</span>`
            : `<span style="font-size: 0.75rem; color: var(--text-muted);">Draft / In Progress</span>`);

      return `
        <div class="visit-archive-card">
          <div class="visit-card-top">
            ${badgeHtml}
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; font-weight: 700; color: var(--emerald-400);">
              ${v.status === 'Completed' ? `${attParts || v.attendeeCount || totalParts || 0} Attendees` : (attParts > 0 ? `${attParts} Attended` : `${totalParts} Delegates`)}
            </span>
          </div>

          <h4 class="visit-card-name">${escapeHtml(v.company)}</h4>

          <div class="visit-card-meta">
            <span>📅 ${escapeHtml(v.date || 'TBD')} &bull; Capacity: ${v.capacity || v.attendeeCount || 25}</span>
            <span>🏛️ ${escapeHtml(v.organisedBy || 'IEEE Student Branch')}</span>
            ${dbTag}
            ${confParts > 0 ? `<span style="color: var(--text-secondary); font-size: 0.75rem;">RSVPs: <strong>${confParts}</strong> Confirmed</span>` : ''}
          </div>

          <div class="visit-card-actions">
            <button class="btn btn-primary btn-sm btn-open-visit-roster" data-visit-id="${escapeHtml(v.id)}" title="View/edit participant details and mark attendance during visit">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 14px; height: 14px;">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              View/Edit Roster
            </button>
            <button class="btn btn-secondary btn-sm btn-download-visit-excel" data-visit-id="${escapeHtml(v.id)}" title="Download Excel roster for this visit">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 14px; height: 14px;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              Download (.xlsx)
            </button>
            <button class="btn btn-ghost btn-sm btn-load-visit-workspace" data-visit-id="${escapeHtml(v.id)}" title="Set as active visit in Selection & RSVP workspace">
              Open in Session
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach card button listeners
    container.querySelectorAll('.btn-open-visit-roster').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const visitId = e.currentTarget.getAttribute('data-visit-id');
        openVisitRosterModal(visitId);
      });
    });

    container.querySelectorAll('.btn-download-visit-excel').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const visitId = e.currentTarget.getAttribute('data-visit-id');
        downloadVisitRosterExcel(visitId);
      });
    });

    container.querySelectorAll('.btn-load-visit-workspace').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const visitId = e.currentTarget.getAttribute('data-visit-id');
        loadVisitIntoActiveSession(visitId);
      });
    });
  }

  // --- 13. VISIT ROSTER MODAL: VIEW / EDIT & ON-SITE ATTENDANCE ---
  function openVisitRosterModal(visitId) {
    state.modalActiveVisitId = visitId;
    const visit = state.visits.find(v => v.id === visitId) || state.activeVisit;
    let roster = getVisitRosterById(visitId);

    // If not yet stored in temporary visit database, initialize it now
    if (!state.visitRosters[visitId]) {
      state.visitRosters[visitId] = JSON.parse(JSON.stringify(roster));
      roster = state.visitRosters[visitId];
    }

    document.getElementById('modal-roster-title').textContent = `Visit Roster & On-Site Attendance: ${visit.company}`;
    document.getElementById('modal-roster-subtitle').textContent = `📅 ${visit.date || 'TBD'} • Capacity: ${visit.capacity || 25} • Organised by: ${visit.organisedBy || 'IEEE SLIIT'}`;

    const tagEl = document.getElementById('modal-db-tag');
    if (tagEl) {
      if (visit.status === 'Completed') {
        tagEl.className = 'badge badge-emerald';
        tagEl.textContent = 'Committed to Main';
      } else {
        tagEl.className = 'badge badge-indigo';
        tagEl.textContent = 'Temporary Visit Database';
      }
    }

    const searchInput = document.getElementById('modal-roster-search');
    if (searchInput) searchInput.value = '';
    const filterStatus = document.getElementById('modal-roster-filter-status');
    if (filterStatus) filterStatus.value = 'ALL';

    state.modalSearchQuery = '';
    state.modalFilterStatus = 'ALL';

    renderModalRosterTable();
    document.getElementById('modal-visit-roster')?.classList.remove('hidden');
  }

  function renderModalRosterTable() {
    const visitId = state.modalActiveVisitId;
    if (!visitId) return;

    const roster = state.visitRosters[visitId];
    if (!roster) return;

    let parts = roster.participants || [];

    // Stats
    const total = parts.length;
    const confCount = parts.filter(p => p.rsvpStatus === 'Confirmed').length;
    const pendCount = parts.filter(p => p.rsvpStatus === 'Pending').length;
    const declCount = parts.filter(p => p.rsvpStatus === 'Declined').length;
    const attCount = parts.filter(p => p.attended).length;
    const vegCount = parts.filter(p => p.dietary === 'Veg').length;
    const nonVegCount = total - vegCount;

    document.getElementById('mstat-total').textContent = total;
    document.getElementById('mstat-confirmed').textContent = confCount;
    document.getElementById('mstat-pending').textContent = pendCount;
    document.getElementById('mstat-declined').textContent = declCount;
    document.getElementById('mstat-attended').textContent = `${attCount} / ${total}`;
    document.getElementById('mstat-dietary').textContent = `${vegCount} Veg / ${nonVegCount} Non-Veg`;

    // Filter by search query
    const q = (state.modalSearchQuery || '').toLowerCase().trim();
    if (q) {
      parts = parts.filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.nic && p.nic.toLowerCase().includes(q)) ||
        (p.phone && p.phone.includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.ieeeNumber && p.ieeeNumber.includes(q))
      );
    }

    // Filter by status
    if (state.modalFilterStatus === 'CONFIRMED') {
      parts = parts.filter(p => p.rsvpStatus === 'Confirmed');
    } else if (state.modalFilterStatus === 'ATTENDED') {
      parts = parts.filter(p => p.attended);
    } else if (state.modalFilterStatus === 'NOT_ATTENDED') {
      parts = parts.filter(p => !p.attended);
    }

    const tbody = document.getElementById('tbody-modal-roster');
    if (!tbody) return;

    if (parts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No participants found matching the criteria. Click "+ Add Walk-In Delegate" above to register participants.</td></tr>`;
      return;
    }

    tbody.innerHTML = parts.map((p, idx) => {
      const isAttended = Boolean(p.attended);
      const isMember = Boolean(p.ieeeNumber && p.ieeeNumber.length > 5);
      const memberBadge = isMember 
        ? `<span class="badge badge-indigo" title="IEEE Member: ${escapeHtml(p.ieeeNumber)}">IEEE</span>` 
        : `<span class="badge badge-subtle">Non-Member</span>`;
      
      const cleanPhone = (p.phone || '').replace(/[^0-9]/g, '');
      const waLink = cleanPhone ? `https://wa.me/94${cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone}` : '#';

      return `
        <tr style="${isAttended ? 'background: rgba(16, 185, 129, 0.05);' : ''}">
          <td style="font-family: 'JetBrains Mono', monospace; color: var(--text-muted); text-align: center;">${idx + 1}</td>
          <td style="text-align: center;">
            <input type="checkbox" class="attend-toggle-large m-attend-cb" data-part-id="${escapeHtml(p.id)}" ${isAttended ? 'checked' : ''} title="Tick to mark attendance on-site">
          </td>
          <td>
            <strong>${escapeHtml(p.name)}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(p.degree || '')} ${p.year ? `&bull; ${escapeHtml(p.year)}` : ''}</div>
          </td>
          <td><code>${escapeHtml(p.nic)}</code></td>
          <td>
            ${memberBadge}
            ${p.ieeeNumber ? `<div style="font-size: 0.75rem; color: var(--text-secondary);">${escapeHtml(p.ieeeNumber)}</div>` : ''}
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span>${escapeHtml(p.phone || '-')}</span>
              ${cleanPhone ? `<a href="${waLink}" target="_blank" title="WhatsApp Chat" style="color: #25D366; text-decoration: none;">💬</a>` : ''}
            </div>
          </td>
          <td><span style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(p.email || '-')}</span></td>
          <td>
            <span class="badge ${p.dietary === 'Veg' ? 'badge-emerald' : 'badge-subtle'}">${escapeHtml(p.dietary || 'Non-Veg')}</span>
          </td>
          <td>
            <select class="status-pill-select status-${(p.rsvpStatus || 'pending').toLowerCase()} m-rsvp-select" data-part-id="${escapeHtml(p.id)}">
              <option value="Confirmed" ${p.rsvpStatus === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
              <option value="Pending" ${p.rsvpStatus === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="Declined" ${p.rsvpStatus === 'Declined' ? 'selected' : ''}>Declined</option>
            </select>
          </td>
          <td style="text-align: center;">
            <div style="display: flex; justify-content: center; gap: 0.35rem;">
              <button class="btn btn-secondary btn-sm btn-edit-roster-part" data-part-id="${escapeHtml(p.id)}" title="Edit participant details">
                ✎
              </button>
              <button class="btn btn-ghost danger btn-sm btn-delete-roster-part" data-part-id="${escapeHtml(p.id)}" title="Remove from this roster">
                ✕
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attendance toggle listener
    tbody.querySelectorAll('.m-attend-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const partId = e.currentTarget.getAttribute('data-part-id');
        const target = roster.participants.find(p => p.id === partId);
        if (target) {
          target.attended = e.currentTarget.checked;
          if (state.activeVisit && state.activeVisit.id === visitId) {
            if (target.attended) state.attendedNics.add(target.nic);
            else state.attendedNics.delete(target.nic);
          }
          saveState();
          renderModalRosterTable();
        }
      });
    });

    // RSVP select listener
    tbody.querySelectorAll('.m-rsvp-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const partId = e.currentTarget.getAttribute('data-part-id');
        const target = roster.participants.find(p => p.id === partId);
        if (target) {
          target.rsvpStatus = e.currentTarget.value;
          if (state.activeVisit && state.activeVisit.id === visitId) {
            state.rsvpStatuses[target.nic] = target.rsvpStatus;
          }
          saveState();
          renderModalRosterTable();
        }
      });
    });

    // Edit participant listener
    tbody.querySelectorAll('.btn-edit-roster-part').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const partId = e.currentTarget.getAttribute('data-part-id');
        openEditParticipantModal(partId);
      });
    });

    // Delete participant listener
    tbody.querySelectorAll('.btn-delete-roster-part').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const partId = e.currentTarget.getAttribute('data-part-id');
        const target = roster.participants.find(p => p.id === partId);
        if (!target) return;
        if (confirm(`Remove ${target.name} from the ${roster.company} visit roster?`)) {
          roster.participants = roster.participants.filter(p => p.id !== partId);
          saveState();
          renderModalRosterTable();
          showToast(`Removed ${target.name} from roster.`);
        }
      });
    });
  }

  // --- 14. EDIT PARTICIPANT DETAILS ---
  function openEditParticipantModal(partId) {
    const visitId = state.modalActiveVisitId;
    if (!visitId || !state.visitRosters[visitId]) return;
    const roster = state.visitRosters[visitId];
    const part = roster.participants.find(p => p.id === partId);
    if (!part) return;

    document.getElementById('edit-part-id').value = part.id;
    document.getElementById('edit-part-name').value = part.name || '';
    document.getElementById('edit-part-nic').value = part.nic || '';
    document.getElementById('edit-part-ieee').value = part.ieeeNumber || '';
    document.getElementById('edit-part-phone').value = part.phone || '';
    document.getElementById('edit-part-email').value = part.email || '';
    document.getElementById('edit-part-dietary').value = part.dietary || 'Non-Veg';
    document.getElementById('edit-part-rsvp').value = part.rsvpStatus || 'Confirmed';
    document.getElementById('edit-part-attended').checked = Boolean(part.attended);
    document.getElementById('edit-part-notes').value = part.notes || '';

    document.getElementById('modal-edit-participant')?.classList.remove('hidden');
  }

  document.getElementById('form-edit-participant')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const visitId = state.modalActiveVisitId;
    if (!visitId || !state.visitRosters[visitId]) return;
    const roster = state.visitRosters[visitId];
    const partId = document.getElementById('edit-part-id').value;
    const part = roster.participants.find(p => p.id === partId);
    if (!part) return;

    part.name = document.getElementById('edit-part-name').value.trim();
    part.nic = document.getElementById('edit-part-nic').value.trim();
    part.ieeeNumber = document.getElementById('edit-part-ieee').value.trim();
    part.isMember = Boolean(part.ieeeNumber && part.ieeeNumber.length > 5);
    part.phone = document.getElementById('edit-part-phone').value.trim();
    part.email = document.getElementById('edit-part-email').value.trim();
    part.dietary = document.getElementById('edit-part-dietary').value;
    part.rsvpStatus = document.getElementById('edit-part-rsvp').value;
    part.attended = document.getElementById('edit-part-attended').checked;
    part.notes = document.getElementById('edit-part-notes').value.trim();

    if (state.activeVisit && state.activeVisit.id === visitId) {
      state.rsvpStatuses[part.nic] = part.rsvpStatus;
      if (part.attended) state.attendedNics.add(part.nic);
      else state.attendedNics.delete(part.nic);
    }

    saveState();
    document.getElementById('modal-edit-participant')?.classList.add('hidden');
    renderModalRosterTable();
    showToast(`Updated details for ${part.name}`);
  });

  // --- 15. ADD WALK-IN DELEGATE ---
  document.getElementById('form-add-roster-participant')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const visitId = state.modalActiveVisitId;
    if (!visitId || !state.visitRosters[visitId]) return;
    const roster = state.visitRosters[visitId];

    const name = document.getElementById('add-part-name').value.trim();
    const nic = document.getElementById('add-part-nic').value.trim();
    const ieee = document.getElementById('add-part-ieee').value.trim();
    const phone = document.getElementById('add-part-phone').value.trim();
    const email = document.getElementById('add-part-email').value.trim();
    const dietary = document.getElementById('add-part-dietary').value;
    const rsvp = document.getElementById('add-part-rsvp').value;
    const attended = document.getElementById('add-part-attended').checked;

    const newPart = {
      id: `WALK-${Date.now()}`,
      name,
      nic,
      ieeeNumber: ieee,
      isMember: Boolean(ieee && ieee.length > 5),
      phone,
      email,
      degree: 'Walk-In Delegate',
      year: '',
      dietary,
      rsvpStatus: rsvp,
      attended,
      notes: 'Added on-site during visit'
    };

    roster.participants.push(newPart);

    if (state.activeVisit && state.activeVisit.id === visitId) {
      state.selectedNics.add(nic);
      state.rsvpStatuses[nic] = rsvp;
      if (attended) state.attendedNics.add(nic);
    }

    saveState();
    document.getElementById('modal-add-roster-participant')?.classList.add('hidden');
    renderModalRosterTable();
    showToast(`Added ${name} to visit roster!`);
    e.target.reset();
  });

  // --- 16. COMMIT ATTENDANCE TO MAIN FROM ROSTER ---
  function commitRosterAttendanceToMain(visitId) {
    const roster = getVisitRosterById(visitId);
    if (!roster || !roster.participants) {
      showToast('No roster found to commit.', 'error');
      return;
    }

    const attendedParticipants = roster.participants.filter(p => p.attended);
    if (attendedParticipants.length === 0) {
      showToast('No participants marked as Attended. Please tick attendance checkboxes first.', 'error');
      return;
    }

    if (!confirm(`Commit attendance for ${attendedParticipants.length} attendees of ${roster.company} to the Main Master Database? This will update each member's total visit count and recorded companies.`)) {
      return;
    }

    const company = roster.company;
    let newEnrolled = 0;
    let updatedCount = 0;

    attendedParticipants.forEach(p => {
      let member = state.members.find(m => m.nic.toLowerCase() === p.nic.toLowerCase());
      if (member) {
        if (!member.visitsAttended) member.visitsAttended = [];
        if (!member.visitsAttended.includes(company)) {
          member.visitsAttended.push(company);
          member.totalVisits = member.visitsAttended.length;
          updatedCount++;
        }
      } else {
        state.members.push({
          id: `MEM-${state.members.length + 1}`,
          name: p.name,
          nic: p.nic,
          ieeeNumber: p.ieeeNumber || '',
          phone: p.phone || '',
          email: p.email || '',
          visitsAttended: [company],
          totalVisits: 1,
          blacklisted: false,
          blacklistReason: ''
        });
        newEnrolled++;
      }
    });

    roster.status = 'Completed';
    const visitRecord = state.visits.find(v => v.id === visitId || v.company.toLowerCase() === company.toLowerCase());
    if (visitRecord) {
      visitRecord.status = 'Completed';
      visitRecord.attendeeCount = attendedParticipants.length;
    }
    if (state.activeVisit && state.activeVisit.id === visitId) {
      state.activeVisit.status = 'Completed';
    }

    syncVisitsFromMembers();
    saveState();
    populateCompanyFilterDropdown();
    renderMasterRoster();
    renderVisitsHistory();
    renderModalRosterTable();
    showToast(`✓ Attendance locked! Updated ${updatedCount} members and enrolled ${newEnrolled} new members into Main.`);
  }

  // --- 17. LOAD VISIT INTO ACTIVE SESSION ---
  function loadVisitIntoActiveSession(visitId) {
    const visit = state.visits.find(v => v.id === visitId);
    if (!visit) return;
    const roster = getVisitRosterById(visitId);

    state.activeVisit = {
      id: visit.id,
      company: visit.company,
      date: visit.date,
      capacity: visit.capacity || 25,
      organisedBy: visit.organisedBy || 'IEEE SLIIT',
      status: visit.status || 'Shortlisting'
    };

    if (roster && roster.participants && roster.participants.length > 0) {
      state.selectedNics.clear();
      state.attendedNics.clear();
      state.rsvpStatuses = {};

      roster.participants.forEach(p => {
        state.selectedNics.add(p.nic);
        state.rsvpStatuses[p.nic] = p.rsvpStatus || 'Pending';
        if (p.attended) state.attendedNics.add(p.nic);
      });

      roster.participants.forEach(p => {
        if (!state.applicants.find(a => a.nic === p.nic)) {
          state.applicants.push({
            id: p.id,
            name: p.name,
            nic: p.nic,
            ieeeNumber: p.ieeeNumber,
            isMember: p.isMember,
            phone: p.phone,
            email: p.email,
            degree: p.degree,
            year: p.year,
            dietary: p.dietary,
            timestamp: new Date().toISOString(),
            totalVisits: 0,
            blacklisted: false,
            blacklistReason: '',
            unmatched: false
          });
        }
      });
    }

    saveState();
    showToast(`Loaded ${visit.company} into active session!`);
    const rsvpTab = document.querySelector('[data-tab="tab-rsvp"]');
    if (rsvpTab) rsvpTab.click();
  }

  // --- 18. EXCEL EXPORT FUNCTIONS ---
  function downloadVisitRosterExcel(visitId) {
    const roster = getVisitRosterById(visitId);
    if (!roster || !roster.participants || roster.participants.length === 0) {
      showToast('No participants found in this visit roster to export.', 'error');
      return;
    }

    const exportData = roster.participants.map((p, idx) => ({
      '#': idx + 1,
      'Full Name': p.name,
      'NIC': p.nic,
      'IEEE Membership #': p.ieeeNumber || '',
      'Phone Number': p.phone || '',
      'Email Address': p.email || '',
      'Degree Program': p.degree || '',
      'Year of Study': p.year || '',
      'Dietary Preference': p.dietary || 'Non-Veg',
      'RSVP Status': p.rsvpStatus || 'Pending',
      'Attended (On-Site)': p.attended ? 'YES' : 'NO',
      'Notes': p.notes || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Visit Roster');
    const safeComp = (roster.company || 'Visit').replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(workbook, `${safeComp}_Visit_Roster_${roster.date || new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast(`✓ Exported ${exportData.length} delegates for ${roster.company}!`);
  }

  // Export All Members
  document.getElementById('btn-export-all-members')?.addEventListener('click', () => {
    showToast('Exporting Master Database to Excel...');
    
    // Dynamically collect all visited companies in order of state.visits, then any others
    const companySet = new Set();
    const companies = [];
    state.visits.forEach(v => {
      if (v.company && !companySet.has(v.company)) {
        companySet.add(v.company);
        companies.push(v.company);
      }
    });
    state.members.forEach(m => {
      if (Array.isArray(m.visitsAttended)) {
        m.visitsAttended.forEach(c => {
          if (c && !companySet.has(c)) {
            companySet.add(c);
            companies.push(c);
          }
        });
      }
    });

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

  // --- 19. ATTACH GLOBAL LISTENERS & BOOTSTRAP ---
  // Save temporary roster buttons
  document.querySelectorAll('#btn-save-temp-roster, #btn-save-temp-roster-sel').forEach(btn => {
    btn?.addEventListener('click', saveCurrentRosterToVisitDb);
  });

  // Download roster button in RSVP tab
  document.getElementById('btn-export-rsvp-excel')?.addEventListener('click', () => {
    downloadVisitRosterExcel(state.activeVisit.id);
  });

  // Visits History filters
  document.getElementById('history-search-input')?.addEventListener('input', renderVisitsHistory);
  document.getElementById('history-filter-status')?.addEventListener('change', renderVisitsHistory);

  // Modal controls for #modal-visit-roster
  document.getElementById('modal-roster-search')?.addEventListener('input', (e) => {
    state.modalSearchQuery = e.target.value;
    renderModalRosterTable();
  });

  document.getElementById('modal-roster-filter-status')?.addEventListener('change', (e) => {
    state.modalFilterStatus = e.target.value;
    renderModalRosterTable();
  });

  document.getElementById('btn-modal-mark-all-confirmed')?.addEventListener('click', () => {
    const visitId = state.modalActiveVisitId;
    if (!visitId || !state.visitRosters[visitId]) return;
    const roster = state.visitRosters[visitId];
    let count = 0;
    roster.participants.forEach(p => {
      if (p.rsvpStatus === 'Confirmed') {
        p.attended = true;
        if (state.activeVisit && state.activeVisit.id === visitId) state.attendedNics.add(p.nic);
        count++;
      }
    });
    saveState();
    renderModalRosterTable();
    showToast(`Marked ${count} confirmed delegates as Attended!`);
  });

  document.getElementById('btn-modal-clear-attendance')?.addEventListener('click', () => {
    const visitId = state.modalActiveVisitId;
    if (!visitId || !state.visitRosters[visitId]) return;
    const roster = state.visitRosters[visitId];
    roster.participants.forEach(p => {
      p.attended = false;
      if (state.activeVisit && state.activeVisit.id === visitId) state.attendedNics.delete(p.nic);
    });
    saveState();
    renderModalRosterTable();
    showToast('Cleared on-site attendance markings.');
  });

  document.getElementById('btn-modal-add-participant')?.addEventListener('click', () => {
    document.getElementById('modal-add-roster-participant')?.classList.remove('hidden');
  });

  document.getElementById('btn-modal-download-excel')?.addEventListener('click', () => {
    downloadVisitRosterExcel(state.modalActiveVisitId);
  });

  document.getElementById('btn-modal-save-changes')?.addEventListener('click', () => {
    saveState();
    showToast('✓ Saved changes to Temporary Visit Database!');
    renderVisitsHistory();
  });

  document.getElementById('btn-modal-commit-main')?.addEventListener('click', () => {
    commitRosterAttendanceToMain(state.modalActiveVisitId);
  });

  // Bootstrap
  document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    syncVisitsFromMembers();
    populateCompanyFilterDropdown();
    updateKPIs();
    renderMasterRoster();

    // Auto-load applicants if none saved yet in local storage
    if (state.applicants.length === 0 && window.IVPMS_INITIAL_DATA && window.IVPMS_INITIAL_DATA.sampleApplicants) {
      ingestFormResponses(window.IVPMS_INITIAL_DATA.sampleApplicants);
    } else {
      renderSelectionEngine();
      renderRsvpManager();
    }
  });

})();
