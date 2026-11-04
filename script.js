/**
 * GIFTLY — Personal Gift-Planning Companion
 * Technology: Vanilla JavaScript (ES6+), HTML5, CSS3, localStorage
 * 
 * Architecture:
 * - DataStore: LocalStorage persistence, validation, cascading deletes
 * - GiftlyApp: View controllers, event handling, modal management, toasts
 */

(function () {
  'use strict';

  /* ===================================================================
     STORAGE KEYS & INITIAL SEED DATA
     =================================================================== */

  const STORAGE_KEYS = {
    RECIPIENTS: 'giftly_recipients',
    NOTES: 'giftly_notes',
    GIFTS: 'giftly_gifts',
    OCCASIONS: 'giftly_occasions',
    INITIALIZED: 'giftly_initialized'
  };

  // Helper to generate unique IDs
  function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`;
  }

  /* ===================================================================
     DATA STORE (LOCAL STORAGE PERSISTENCE)
     =================================================================== */

  const DataStore = {
    // Safe storage reader with fallback
    _get(key) {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : [];
      } catch (err) {
        console.error(`Error reading ${key} from localStorage:`, err);
        return [];
      }
    },

    // Safe storage writer
    _set(key, data) {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (err) {
        console.error(`Error saving ${key} to localStorage:`, err);
      }
    },

    // Initialize empty collections only when storage keys do not already exist
    // Does NOT overwrite or delete existing user-generated records
    init() {
      if (localStorage.getItem(STORAGE_KEYS.RECIPIENTS) === null) {
        this._set(STORAGE_KEYS.RECIPIENTS, []);
      }
      if (localStorage.getItem(STORAGE_KEYS.NOTES) === null) {
        this._set(STORAGE_KEYS.NOTES, []);
      }
      if (localStorage.getItem(STORAGE_KEYS.GIFTS) === null) {
        this._set(STORAGE_KEYS.GIFTS, []);
      }
      if (localStorage.getItem(STORAGE_KEYS.OCCASIONS) === null) {
        this._set(STORAGE_KEYS.OCCASIONS, []);
      }
    },

    // --- RECIPIENTS CRUD ---
    getRecipients() {
      return this._get(STORAGE_KEYS.RECIPIENTS);
    },

    getRecipientById(id) {
      const list = this.getRecipients();
      return list.find(r => r.id === id) || null;
    },

    saveRecipient(recipientData) {
      const list = this.getRecipients();
      if (recipientData.id) {
        const idx = list.findIndex(r => r.id === recipientData.id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...recipientData };
        } else {
          list.push(recipientData);
        }
      } else {
        recipientData.id = generateId('rec');
        list.push(recipientData);
      }
      this._set(STORAGE_KEYS.RECIPIENTS, list);
      return recipientData;
    },

    // Safe Cascading Delete of Recipient and All Connected Records
    deleteRecipient(id) {
      // 1. Remove recipient
      const recipients = this.getRecipients().filter(r => r.id !== id);
      this._set(STORAGE_KEYS.RECIPIENTS, recipients);

      // 2. Cascade remove thought notes
      const allNotes = this.getNotes();
      const removedNotesCount = allNotes.filter(n => n.recipientId === id).length;
      const remainingNotes = allNotes.filter(n => n.recipientId !== id);
      this._set(STORAGE_KEYS.NOTES, remainingNotes);

      // 3. Cascade remove gifts
      const allGifts = this.getGifts();
      const removedGiftsCount = allGifts.filter(g => g.recipientId === id).length;
      const remainingGifts = allGifts.filter(g => g.recipientId !== id);
      this._set(STORAGE_KEYS.GIFTS, remainingGifts);

      // 4. Cascade remove occasions
      const allOccasions = this.getOccasions();
      const removedOccasionsCount = allOccasions.filter(o => o.recipientId === id).length;
      const remainingOccasions = allOccasions.filter(o => o.recipientId !== id);
      this._set(STORAGE_KEYS.OCCASIONS, remainingOccasions);

      return {
        removedNotesCount,
        removedGiftsCount,
        removedOccasionsCount
      };
    },

    // Counts connected records for confirmation dialog before deleting
    getRecipientCascadeCounts(id) {
      const notes = this.getNotes().filter(n => n.recipientId === id).length;
      const gifts = this.getGifts().filter(g => g.recipientId === id).length;
      const occasions = this.getOccasions().filter(o => o.recipientId === id).length;
      return { notes, gifts, occasions };
    },

    // --- THOUGHT NOTES CRUD ---
    getNotes() {
      return this._get(STORAGE_KEYS.NOTES);
    },

    getNoteById(id) {
      return this.getNotes().find(n => n.id === id) || null;
    },

    getNotesForRecipient(recipientId) {
      return this.getNotes().filter(n => n.recipientId === recipientId);
    },

    saveNote(noteData) {
      const list = this.getNotes();
      if (noteData.id) {
        const idx = list.findIndex(n => n.id === noteData.id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...noteData };
        } else {
          list.push(noteData);
        }
      } else {
        noteData.id = generateId('note');
        list.push(noteData);
      }
      this._set(STORAGE_KEYS.NOTES, list);
      return noteData;
    },

    deleteNote(id) {
      const list = this.getNotes().filter(n => n.id !== id);
      this._set(STORAGE_KEYS.NOTES, list);
    },

    // --- GIFTS CRUD ---
    getGifts() {
      return this._get(STORAGE_KEYS.GIFTS);
    },

    getGiftById(id) {
      return this.getGifts().find(g => g.id === id) || null;
    },

    getGiftsForRecipient(recipientId) {
      return this.getGifts().filter(g => g.recipientId === recipientId);
    },

    saveGift(giftData) {
      const list = this.getGifts();
      giftData.budget = Number(giftData.budget) || 0;
      if (giftData.id) {
        const idx = list.findIndex(g => g.id === giftData.id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...giftData };
        } else {
          list.push(giftData);
        }
      } else {
        giftData.id = generateId('gift');
        list.push(giftData);
      }
      this._set(STORAGE_KEYS.GIFTS, list);
      return giftData;
    },

    updateGiftStatus(id, newStatus) {
      const list = this.getGifts();
      const item = list.find(g => g.id === id);
      if (item) {
        item.status = newStatus;
        this._set(STORAGE_KEYS.GIFTS, list);
      }
      return item;
    },

    deleteGift(id) {
      const list = this.getGifts().filter(g => g.id !== id);
      this._set(STORAGE_KEYS.GIFTS, list);
    },

    // --- OCCASIONS CRUD ---
    getOccasions() {
      return this._get(STORAGE_KEYS.OCCASIONS);
    },

    getOccasionById(id) {
      return this.getOccasions().find(o => o.id === id) || null;
    },

    getOccasionsForRecipient(recipientId) {
      return this.getOccasions().filter(o => o.recipientId === recipientId);
    },

    saveOccasion(occData) {
      const list = this.getOccasions();
      if (occData.id) {
        const idx = list.findIndex(o => o.id === occData.id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...occData };
        } else {
          list.push(occData);
        }
      } else {
        occData.id = generateId('occ');
        list.push(occData);
      }
      this._set(STORAGE_KEYS.OCCASIONS, list);
      return occData;
    },

    deleteOccasion(id) {
      const list = this.getOccasions().filter(o => o.id !== id);
      this._set(STORAGE_KEYS.OCCASIONS, list);
    }
  };

  /* ===================================================================
     UTILITY HELPERS (FORMATTING, DATES, AVATARS)
     =================================================================== */

  // Currency Formatter in Nigerian Naira (₦)
  function formatNaira(amount) {
    const num = Math.round(Number(amount) || 0);
    return '₦' + num.toLocaleString('en-NG');
  }

  // Generate Initials from Full Name
  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  // Generate consistent color index (0..7) based on string
  function getAvatarColorClass(str) {
    if (!str) return 'avatar-bg-0';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % 8;
    return `avatar-bg-${idx}`;
  }

  // Safe HTML Escaping for User-Generated Strings
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Calculate Next Occurrence & Days Remaining for Occasions
  function calculateOccasionCountdown(dateStr, occasionType) {
    if (!dateStr) {
      return { diffDays: 9999, label: 'No date', badgeClass: 'badge-countdown-normal', targetDateStr: '' };
    }

    const parts = dateStr.split('-');
    if (parts.length !== 3) {
      return { diffDays: 9999, label: 'Invalid date', badgeClass: 'badge-countdown-normal', targetDateStr: dateStr };
    }

    const origYear = parseInt(parts[0], 10);
    const origMonth = parseInt(parts[1], 10) - 1; // 0-based
    const origDay = parseInt(parts[2], 10);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Recurring annual occasions: Birthday, Anniversary, Christmas, Valentine's Day, etc.
    const recurringTypes = ['Birthday', 'Anniversary', 'Valentine\'s Day', 'Christmas', 'Mother\'s Day', 'Father\'s Day'];
    const isRecurring = recurringTypes.includes(occasionType) || occasionType !== 'Other';

    let targetDate;
    if (isRecurring) {
      let currentYear = today.getFullYear();
      targetDate = new Date(currentYear, origMonth, origDay);
      // If already passed this calendar year, roll over to next year
      if (targetDate < today) {
        targetDate = new Date(currentYear + 1, origMonth, origDay);
      }
    } else {
      targetDate = new Date(origYear, origMonth, origDay);
    }

    const diffMs = targetDate.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    let label = '';
    let badgeClass = 'badge-countdown-normal';

    if (diffDays === 0) {
      label = 'Today';
      badgeClass = 'badge-countdown-today';
    } else if (diffDays === 1) {
      label = 'Tomorrow';
      badgeClass = 'badge-countdown-soon';
    } else if (diffDays > 1 && diffDays <= 7) {
      label = `In ${diffDays} days`;
      badgeClass = 'badge-countdown-soon';
    } else if (diffDays > 7 && diffDays < 14) {
      label = `In 1 week`;
      badgeClass = 'badge-countdown-normal';
    } else if (diffDays >= 14 && diffDays < 30) {
      label = `In ${Math.floor(diffDays / 7)} weeks`;
      badgeClass = 'badge-countdown-normal';
    } else if (diffDays >= 30 && diffDays < 60) {
      label = `In 1 month`;
      badgeClass = 'badge-countdown-normal';
    } else if (diffDays >= 60 && diffDays < 366) {
      label = `In ${Math.floor(diffDays / 30)} months`;
      badgeClass = 'badge-countdown-normal';
    } else if (diffDays < 0) {
      label = diffDays === -1 ? 'Yesterday' : `${Math.abs(diffDays)} days ago`;
      badgeClass = 'badge-countdown-normal';
    } else {
      label = `In ${diffDays} days`;
    }

    const targetDateFormatted = targetDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const dayOfWeek = targetDate.toLocaleDateString('en-US', { weekday: 'short' });

    return {
      diffDays,
      label,
      badgeClass,
      targetDateStr: targetDateFormatted,
      dayOfWeek
    };
  }

  // Format simple date (e.g. "Oct 14, 2026")
  function formatHumanDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // Get Category Badge Style Class
  function getCategoryBadgeClass(category) {
    switch (category) {
      case 'Things they want': return 'badge-category-wants';
      case 'Favourite things': return 'badge-category-favourites';
      case 'Interests and hobbies': return 'badge-category-interests';
      case 'Experiences': return 'badge-category-experiences';
      case 'Things to avoid': return 'badge-category-avoid';
      default: return 'badge-category-other';
    }
  }

  // Get Gift Status Badge Style Class
  function getGiftStatusBadgeClass(status) {
    switch (status) {
      case 'Planned': return 'badge-status-planned';
      case 'Purchased': return 'badge-status-purchased';
      case 'Gifted': return 'badge-status-gifted';
      default: return 'badge-subtle';
    }
  }

  /* ===================================================================
     GIFTLY APPLICATION CONTROLLER
     =================================================================== */

  const GiftlyApp = {
    currentView: 'overview',
    pendingConfirmResolve: null,

    init() {
      DataStore.init();
      this.bindNavigation();
      this.bindSearchAndFilters();
      this.bindForms();
      this.bindGlobalKeyboard();
      this.updateAllViews();

      // Set default captured date on Thought Note form to today
      const todayIso = new Date().toISOString().split('T')[0];
      const noteDateInput = document.getElementById('note-date');
      if (noteDateInput) noteDateInput.value = todayIso;
    },

    // --- NAVIGATION CONTROLLER ---
    bindNavigation() {
      const self = this;
      const navLinks = document.querySelectorAll('.nav-link');
      const mobileToggleBtn = document.getElementById('mobile-menu-toggle');
      const sidebar = document.getElementById('sidebar');
      const mobileOverlay = document.getElementById('mobile-overlay');

      navLinks.forEach(btn => {
        btn.addEventListener('click', () => {
          const view = btn.getAttribute('data-view');
          self.switchView(view);
          self.closeMobileMenu();
        });
      });

      if (mobileToggleBtn) {
        mobileToggleBtn.addEventListener('click', () => {
          sidebar.classList.toggle('mobile-open');
          mobileOverlay.classList.toggle('active');
        });
      }

      if (mobileOverlay) {
        mobileOverlay.addEventListener('click', () => {
          self.closeMobileMenu();
        });
      }

      const quickAddBtn = document.getElementById('quick-add-gift-btn');
      if (quickAddBtn) {
        quickAddBtn.addEventListener('click', () => {
          self.openGiftModal();
          self.closeMobileMenu();
        });
      }
    },

    closeMobileMenu() {
      const sidebar = document.getElementById('sidebar');
      const mobileOverlay = document.getElementById('mobile-overlay');
      if (sidebar) sidebar.classList.remove('mobile-open');
      if (mobileOverlay) mobileOverlay.classList.remove('active');
    },

    switchView(viewName, filterOptions = null) {
      this.currentView = viewName;

      // Update sidebar nav link visual states
      document.querySelectorAll('.nav-link').forEach(btn => {
        if (btn.getAttribute('data-view') === viewName) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      // Update view section visibility
      document.querySelectorAll('.view-section').forEach(sec => {
        if (sec.id === `view-${viewName}`) {
          sec.classList.add('active');
        } else {
          sec.classList.remove('active');
        }
      });

      // Apply any filter presets passed during view transition
      if (filterOptions) {
        if (viewName === 'gifts' && filterOptions.filterStatus) {
          const statusSelect = document.getElementById('filter-gifts-status');
          if (statusSelect) statusSelect.value = filterOptions.filterStatus;
        }
      }

      // Scroll top of viewport
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Refresh view data
      this.updateCurrentView();
    },

    updateAllViews() {
      this.updateSidebarBadges();
      this.renderOverview();
      this.renderPeople();
      this.renderNotes();
      this.renderGifts();
      this.renderOccasions();
      this.populateRecipientSelects();
    },

    updateCurrentView() {
      this.updateSidebarBadges();
      switch (this.currentView) {
        case 'overview':
          this.renderOverview();
          break;
        case 'people':
          this.renderPeople();
          break;
        case 'notes':
          this.renderNotes();
          break;
        case 'gifts':
          this.renderGifts();
          break;
        case 'occasions':
          this.renderOccasions();
          break;
      }
    },

    updateSidebarBadges() {
      const pCount = DataStore.getRecipients().length;
      const nCount = DataStore.getNotes().length;
      const gCount = DataStore.getGifts().length;
      const oCount = DataStore.getOccasions().length;

      const elP = document.getElementById('nav-count-people');
      const elN = document.getElementById('nav-count-notes');
      const elG = document.getElementById('nav-count-gifts');
      const elO = document.getElementById('nav-count-occasions');

      if (elP) elP.textContent = pCount;
      if (elN) elN.textContent = nCount;
      if (elG) elG.textContent = gCount;
      if (elO) elO.textContent = oCount;
    },

    // Populate recipient dropdowns across all modals and filters
    populateRecipientSelects() {
      const recipients = DataStore.getRecipients();
      const selects = [
        document.getElementById('note-recipient'),
        document.getElementById('gift-recipient'),
        document.getElementById('occasion-recipient'),
        document.getElementById('filter-notes-recipient'),
        document.getElementById('filter-gifts-recipient'),
        document.getElementById('filter-occasions-recipient')
      ];

      selects.forEach(sel => {
        if (!sel) return;
        const isFilter = sel.id.startsWith('filter-');
        const currentValue = sel.value;

        sel.innerHTML = isFilter
          ? '<option value="">All Recipients</option>'
          : '<option value="">Select recipient</option>';

        if (recipients.length === 0) {
          const emptyOption = document.createElement('option');
          emptyOption.value = '';
          emptyOption.disabled = true;
          emptyOption.textContent = isFilter
            ? 'No recipients added yet'
            : 'Add a recipient in People first';
          sel.appendChild(emptyOption);
        }

        recipients.forEach(r => {
          const opt = document.createElement('option');
          opt.value = r.id;
          opt.textContent = `${r.name} (${r.relationship})`;
          sel.appendChild(opt);
        });

        // Retain previous value if still exists
        if (currentValue && recipients.some(r => r.id === currentValue)) {
          sel.value = currentValue;
        }
      });
    },

    /* ===================================================================
       1. OVERVIEW DASHBOARD VIEW CONTROLLER
       =================================================================== */

    renderOverview() {
      const recipients = DataStore.getRecipients();
      const notes = DataStore.getNotes();
      const gifts = DataStore.getGifts();
      const occasions = DataStore.getOccasions();

      // Dynamic Greeting
      const greetingEl = document.getElementById('welcome-greeting');
      if (greetingEl) {
        const hour = new Date().getHours();
        let greeting = 'Welcome to Giftly';
        if (hour < 12) greeting = 'Good morning, welcome to Giftly';
        else if (hour < 17) greeting = 'Good afternoon, welcome to Giftly';
        else greeting = 'Good evening, welcome to Giftly';
        greetingEl.textContent = greeting;
      }

      // Summary Metric Cards
      const plannedGifts = gifts.filter(g => g.status === 'Planned');
      const purchasedGifts = gifts.filter(g => g.status === 'Purchased');
      const giftedGifts = gifts.filter(g => g.status === 'Gifted');

      const elRecipients = document.getElementById('stat-total-recipients');
      const elGifts = document.getElementById('stat-total-gifts');
      const elPlanned = document.getElementById('stat-planned-gifts');
      const elPurchased = document.getElementById('stat-purchased-gifts');

      if (elRecipients) elRecipients.textContent = recipients.length;
      if (elGifts) elGifts.textContent = gifts.length;
      if (elPlanned) elPlanned.textContent = plannedGifts.length;
      if (elPurchased) elPurchased.textContent = purchasedGifts.length;

      // Budget Calculations:
      // Total Estimated Budget = Planned + Purchased (Never include Gifted)
      const totalEstimated = plannedGifts.reduce((acc, g) => acc + (Number(g.budget) || 0), 0) +
                             purchasedGifts.reduce((acc, g) => acc + (Number(g.budget) || 0), 0);
      const totalSpent = purchasedGifts.reduce((acc, g) => acc + (Number(g.budget) || 0), 0);
      const remainingPlanned = plannedGifts.reduce((acc, g) => acc + (Number(g.budget) || 0), 0);

      const elTotalEst = document.getElementById('budget-total-estimated');
      const elTotalSpent = document.getElementById('budget-total-spent');
      const elRemPlanned = document.getElementById('budget-remaining-planned');
      const elProgressText = document.getElementById('budget-progress-text');
      const elProgressCounts = document.getElementById('budget-progress-counts');
      const elProgressFill = document.getElementById('budget-progress-fill');

      if (elTotalEst) elTotalEst.textContent = formatNaira(totalEstimated);
      if (elTotalSpent) elTotalSpent.textContent = formatNaira(totalSpent);
      if (elRemPlanned) elRemPlanned.textContent = formatNaira(remainingPlanned);

      const activeGiftsCount = plannedGifts.length + purchasedGifts.length;
      const percentSpent = totalEstimated > 0 ? Math.min(100, Math.round((totalSpent / totalEstimated) * 100)) : 0;

      if (elProgressText) elProgressText.textContent = `${percentSpent}% of estimated budget spent`;
      if (elProgressCounts) elProgressCounts.textContent = `${purchasedGifts.length} of ${activeGiftsCount} active gifts purchased`;
      if (elProgressFill) elProgressFill.style.width = `${percentSpent}%`;

      // Render Upcoming Occasions on Dashboard (Top 4 sorted by nearest upcoming date)
      this.renderDashboardUpcomingOccasions(occasions, recipients);

      // Render Recent Thought Notes on Dashboard (Top 3 newest notes)
      this.renderDashboardRecentNotes(notes, recipients);
    },

    renderDashboardUpcomingOccasions(occasions, recipients) {
      const container = document.getElementById('dashboard-occasions-list');
      if (!container) return;

      if (occasions.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding: 2.25rem 1.25rem;">
            <p class="empty-title" style="font-size: 1rem;">No upcoming occasions recorded</p>
            <p class="empty-desc" style="font-size: 0.84rem; margin-bottom: 1.15rem;">Add birthdays, anniversaries and other special occasions so you can plan thoughtful surprises ahead of time.</p>
            <button class="btn btn-secondary btn-sm" onclick="GiftlyApp.openOccasionModal()">+ Add Occasion</button>
          </div>
        `;
        return;
      }

      // Calculate countdown for each and sort ascending
      const mapped = occasions.map(occ => {
        const recipient = recipients.find(r => r.id === occ.recipientId) || { name: 'Unknown', id: '' };
        const countdown = calculateOccasionCountdown(occ.date, occ.type);
        return { occ, recipient, countdown };
      });

      mapped.sort((a, b) => a.countdown.diffDays - b.countdown.diffDays);
      const topOccasions = mapped.slice(0, 4);

      container.innerHTML = topOccasions.map(({ occ, recipient, countdown }) => {
        const initials = getInitials(recipient.name);
        const avatarColor = getAvatarColorClass(recipient.name);
        return `
          <div class="mini-occasion-item" onclick="GiftlyApp.openRecipientProfileModal('${recipient.id}')" style="cursor: pointer;" title="View ${escapeHTML(recipient.name)}'s profile">
            <div class="mini-occasion-info">
              <div class="avatar avatar-sm ${avatarColor}">${initials}</div>
              <div class="mini-occasion-meta">
                <h4>${escapeHTML(occ.name)}</h4>
                <p>${escapeHTML(recipient.name)} &bull; ${countdown.targetDateStr} (${countdown.dayOfWeek})</p>
              </div>
            </div>
            <span class="badge ${countdown.badgeClass}">${countdown.label}</span>
          </div>
        `;
      }).join('');
    },

    renderDashboardRecentNotes(notes, recipients) {
      const container = document.getElementById('dashboard-notes-list');
      if (!container) return;

      if (notes.length === 0) {
        container.innerHTML = `
          <div class="empty-state" style="padding: 2.25rem 1.25rem;">
            <p class="empty-title" style="font-size: 1rem;">No thought notes yet</p>
            <p class="empty-desc" style="font-size: 0.84rem; margin-bottom: 1.15rem;">Capture the little things people mention, from something they've always wanted to something they simply love.</p>
            <button class="btn btn-secondary btn-sm" onclick="GiftlyApp.openNoteModal()">+ Record Thought</button>
          </div>
        `;
        return;
      }

      // Sort by date descending
      const sorted = [...notes].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      const topNotes = sorted.slice(0, 3);

      container.innerHTML = topNotes.map(note => {
        const recipient = recipients.find(r => r.id === note.recipientId) || { name: 'Unknown', id: '' };
        const initials = getInitials(recipient.name);
        const avatarColor = getAvatarColorClass(recipient.name);
        const badgeClass = getCategoryBadgeClass(note.category);
        const snippet = note.description.length > 95
          ? note.description.substring(0, 95) + '...'
          : note.description;

        return `
          <div class="mini-note-item">
            <div class="mini-note-header">
              <span class="mini-note-title">${escapeHTML(note.title)}</span>
              <span class="badge ${badgeClass}" style="font-size: 0.7rem;">${escapeHTML(note.category)}</span>
            </div>
            <p class="mini-note-body">"${escapeHTML(snippet)}"</p>
            <div class="mini-note-footer">
              <div class="mini-note-author">
                <div class="avatar avatar-sm ${avatarColor}" style="width: 20px; height: 20px; font-size: 0.62rem;">${initials}</div>
                <span>${escapeHTML(recipient.name)}</span>
              </div>
              <span>${formatHumanDate(note.date)}</span>
            </div>
          </div>
        `;
      }).join('');
    },

    /* ===================================================================
       2. PEOPLE VIEW CONTROLLER
       =================================================================== */

    renderPeople() {
      const container = document.getElementById('people-grid');
      if (!container) return;

      const recipients = DataStore.getRecipients();
      const notes = DataStore.getNotes();
      const gifts = DataStore.getGifts();
      const occasions = DataStore.getOccasions();

      const searchVal = (document.getElementById('search-people')?.value || '').trim().toLowerCase();
      const filterRel = document.getElementById('filter-people-relationship')?.value || '';

      // Filter recipients
      let filtered = recipients.filter(r => {
        const matchesName = r.name.toLowerCase().includes(searchVal);
        const matchesRel = !filterRel || r.relationship === filterRel;
        return matchesName && matchesRel;
      });

      // Clear search button visibility
      const clearBtn = document.getElementById('clear-search-people');
      if (clearBtn) clearBtn.classList.toggle('hidden', searchVal.length === 0);

      if (filtered.length === 0) {
        if (recipients.length === 0) {
          container.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon-wrap">
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                </svg>
              </div>
              <h3 class="empty-title">Your people make Giftly special.</h3>
              <p class="empty-desc">Start by adding someone you love buying gifts for. Save their interests, preferences and important dates so you never run out of thoughtful ideas.</p>
              <button class="btn btn-primary" onclick="GiftlyApp.openRecipientModal()">Add Your First Recipient</button>
            </div>
          `;
        } else {
          container.innerHTML = `
            <div class="empty-state">
              <h3 class="empty-title">No recipients found</h3>
              <p class="empty-desc">We couldn't find anyone matching your search or filter criteria.</p>
              <button class="btn btn-secondary btn-sm" onclick="GiftlyApp.resetPeopleFilters()">Clear Filters</button>
            </div>
          `;
        }
        return;
      }

      container.innerHTML = filtered.map(person => {
        const initials = getInitials(person.name);
        const avatarColor = getAvatarColorClass(person.name);

        const personNotesCount = notes.filter(n => n.recipientId === person.id).length;
        const personGiftsCount = gifts.filter(g => g.recipientId === person.id).length;
        const personOccasionsCount = occasions.filter(o => o.recipientId === person.id).length;

          const interestsPreview = person.interests
          ? (person.interests.length > 75 ? person.interests.substring(0, 75) + '...' : person.interests)
          : null;

        return `
          <div class="content-card person-card" id="card-person-${person.id}">
            <div class="person-card-header">
              <div class="person-primary-info">
                <div class="avatar ${avatarColor}">${initials}</div>
                <div class="person-name-group">
                  <h3>${escapeHTML(person.name)}</h3>
                  <span class="badge badge-subtle person-relationship">${escapeHTML(person.relationship)}</span>
                </div>
              </div>
            </div>

            <div class="person-card-body">
              ${person.favouriteColour ? `
                <div class="person-info-row">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                  </svg>
                  <span>Fav Colour: <strong>${escapeHTML(person.favouriteColour)}</strong></span>
                </div>
              ` : ''}

              ${interestsPreview ? `
                <div class="person-interests-tag">
                  <strong>Interests:</strong> ${escapeHTML(interestsPreview)}
                </div>
              ` : ''}

              <div class="person-stats-row">
                <span class="person-stat-pill">${personGiftsCount} Gifts</span>
                <span class="person-stat-pill">${personNotesCount} Notes</span>
                <span class="person-stat-pill">${personOccasionsCount} Occasions</span>
              </div>
            </div>

            <div class="person-card-actions">
              <button class="btn btn-secondary btn-sm" onclick="GiftlyApp.openRecipientProfileModal('${person.id}')">
                View Profile
              </button>
              <div style="display: flex; gap: 0.35rem;">
                <button class="btn-icon" onclick="GiftlyApp.editRecipient('${person.id}')" title="Edit recipient">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button class="btn-icon btn-icon-danger" onclick="GiftlyApp.confirmDeleteRecipient('${person.id}')" title="Delete recipient">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    },

    resetPeopleFilters() {
      const search = document.getElementById('search-people');
      const rel = document.getElementById('filter-people-relationship');
      if (search) search.value = '';
      if (rel) rel.value = '';
      this.renderPeople();
    },

    /* ===================================================================
       3. THOUGHT NOTES VIEW CONTROLLER
       =================================================================== */

    renderNotes() {
      const container = document.getElementById('notes-grid');
      if (!container) return;

      const notes = DataStore.getNotes();
      const recipients = DataStore.getRecipients();

      const searchVal = (document.getElementById('search-notes')?.value || '').trim().toLowerCase();
      const filterRec = document.getElementById('filter-notes-recipient')?.value || '';
      const filterCat = document.getElementById('filter-notes-category')?.value || '';
      const sortVal = document.getElementById('sort-notes')?.value || 'date-desc';

      // Clear search button visibility
      const clearBtn = document.getElementById('clear-search-notes');
      if (clearBtn) clearBtn.classList.toggle('hidden', searchVal.length === 0);

      let filtered = notes.filter(n => {
        const recipient = recipients.find(r => r.id === n.recipientId);
        const recipientName = recipient ? recipient.name.toLowerCase() : '';
        const matchesSearch = !searchVal ||
          n.title.toLowerCase().includes(searchVal) ||
          n.description.toLowerCase().includes(searchVal) ||
          recipientName.includes(searchVal);
        const matchesRec = !filterRec || n.recipientId === filterRec;
        const matchesCat = !filterCat || n.category === filterCat;
        return matchesSearch && matchesRec && matchesCat;
      });

      // Sorting
      filtered.sort((a, b) => {
        const da = new Date(a.date || 0).getTime();
        const db = new Date(b.date || 0).getTime();
        return sortVal === 'date-asc' ? da - db : db - da;
      });

      if (filtered.length === 0) {
        if (notes.length === 0) {
          container.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon-wrap">
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                </svg>
              </div>
              <h3 class="empty-title">Every thoughtful gift starts with paying attention.</h3>
              <p class="empty-desc">Capture the little things people mention, from something they've always wanted to something they simply love.</p>
              <button class="btn btn-primary" onclick="GiftlyApp.openNoteModal()">Record Your First Thought</button>
            </div>
          `;
        } else {
          container.innerHTML = `
            <div class="empty-state">
              <h3 class="empty-title">No notes match your filters</h3>
              <p class="empty-desc">Try clearing your search terms or picking another category.</p>
              <button class="btn btn-secondary btn-sm" onclick="GiftlyApp.resetNotesFilters()">Clear Filters</button>
            </div>
          `;
        }
        return;
      }

      container.innerHTML = filtered.map(note => {
        const recipient = recipients.find(r => r.id === note.recipientId) || { name: 'Unknown Recipient', id: '' };
        const initials = getInitials(recipient.name);
        const avatarColor = getAvatarColorClass(recipient.name);
        const badgeClass = getCategoryBadgeClass(note.category);

        return `
          <div class="content-card note-card" id="card-note-${note.id}">
            <div class="note-card-header">
              <span class="note-category-badge ${badgeClass}">${escapeHTML(note.category)}</span>
              <span class="note-date-tag">${formatHumanDate(note.date)}</span>
            </div>

            <h3 class="note-title">${escapeHTML(note.title)}</h3>

            <div class="note-quote-body">
              ${escapeHTML(note.description)}
            </div>

            <div class="note-card-footer">
              <div class="note-recipient-tag" onclick="GiftlyApp.openRecipientProfileModal('${recipient.id}')" style="cursor: pointer;" title="View recipient profile">
                <div class="avatar avatar-sm ${avatarColor}">${initials}</div>
                <span class="note-recipient-name">${escapeHTML(recipient.name)}</span>
              </div>

              <div class="note-action-btns">
                <button class="btn btn-secondary btn-sm" onclick="GiftlyApp.convertNoteToGift('${note.id}')" title="Turn this note into a Gift Idea in Vault">
                  + Turn to Gift
                </button>
                <button class="btn-icon" onclick="GiftlyApp.editNote('${note.id}')" title="Edit note">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button class="btn-icon btn-icon-danger" onclick="GiftlyApp.confirmDeleteNote('${note.id}')" title="Delete note">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    },

    resetNotesFilters() {
      const search = document.getElementById('search-notes');
      const rec = document.getElementById('filter-notes-recipient');
      const cat = document.getElementById('filter-notes-category');
      const sort = document.getElementById('sort-notes');
      if (search) search.value = '';
      if (rec) rec.value = '';
      if (cat) cat.value = '';
      if (sort) sort.value = 'date-desc';
      this.renderNotes();
    },

    // Convert Note into Gift Idea shortcut
    convertNoteToGift(noteId) {
      const note = DataStore.getNoteById(noteId);
      if (!note) return;

      this.openGiftModal({
        name: note.title,
        recipientId: note.recipientId,
        description: `Inspired by thought note: "${note.description}"`,
        budget: '',
        status: 'Planned',
        occasion: 'Birthday'
      });
    },

    /* ===================================================================
       4. GIFT VAULT VIEW CONTROLLER
       =================================================================== */

    renderGifts() {
      const container = document.getElementById('gifts-grid');
      if (!container) return;

      const gifts = DataStore.getGifts();
      const recipients = DataStore.getRecipients();

      const searchVal = (document.getElementById('search-gifts')?.value || '').trim().toLowerCase();
      const filterStatus = document.getElementById('filter-gifts-status')?.value || '';
      const filterOcc = document.getElementById('filter-gifts-occasion')?.value || '';
      const filterRec = document.getElementById('filter-gifts-recipient')?.value || '';
      const sortVal = document.getElementById('sort-gifts')?.value || 'date-desc';

      // Clear search button visibility
      const clearBtn = document.getElementById('clear-search-gifts');
      if (clearBtn) clearBtn.classList.toggle('hidden', searchVal.length === 0);

      let filtered = gifts.filter(g => {
        const recipient = recipients.find(r => r.id === g.recipientId);
        const recipientName = recipient ? recipient.name.toLowerCase() : '';
        const matchesSearch = !searchVal ||
          g.name.toLowerCase().includes(searchVal) ||
          recipientName.includes(searchVal) ||
          (g.description && g.description.toLowerCase().includes(searchVal));
        const matchesStatus = !filterStatus || g.status === filterStatus;
        const matchesOcc = !filterOcc || g.occasion === filterOcc;
        const matchesRec = !filterRec || g.recipientId === filterRec;
        return matchesSearch && matchesStatus && matchesOcc && matchesRec;
      });

      // Sorting
      filtered.sort((a, b) => {
        if (sortVal === 'budget-desc') return (Number(b.budget) || 0) - (Number(a.budget) || 0);
        if (sortVal === 'budget-asc') return (Number(a.budget) || 0) - (Number(b.budget) || 0);
        if (sortVal === 'name-asc') return a.name.localeCompare(b.name);
        return 0; // Default order
      });

      if (filtered.length === 0) {
        if (gifts.length === 0) {
          container.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon-wrap">
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
              </div>
              <h3 class="empty-title">Your gift ideas deserve a place.</h3>
              <p class="empty-desc">Save gift ideas as they come to you, organise them by recipient and keep track of what you've planned or purchased.</p>
              <button class="btn btn-primary" onclick="GiftlyApp.openGiftModal()">Add Your First Gift</button>
            </div>
          `;
        } else {
          container.innerHTML = `
            <div class="empty-state">
              <h3 class="empty-title">No gifts found</h3>
              <p class="empty-desc">No gifts match the current search or filter combination.</p>
              <button class="btn btn-secondary btn-sm" onclick="GiftlyApp.resetGiftsFilters()">Clear Filters</button>
            </div>
          `;
        }
        return;
      }

      container.innerHTML = filtered.map(gift => {
        const recipient = recipients.find(r => r.id === gift.recipientId) || { name: 'Unknown Recipient', id: '' };
        const initials = getInitials(recipient.name);
        const avatarColor = getAvatarColorClass(recipient.name);
        const statusBadgeClass = getGiftStatusBadgeClass(gift.status);

        return `
          <div class="content-card gift-card" id="card-gift-${gift.id}">
            <div class="gift-card-header">
              <span class="badge badge-subtle">${escapeHTML(gift.occasion)}</span>
              <!-- Direct status dropdown for quick status updating -->
              <select class="form-select gift-status-select ${statusBadgeClass}" onchange="GiftlyApp.handleStatusChange('${gift.id}', this.value)" aria-label="Change gift status">
                <option value="Planned" ${gift.status === 'Planned' ? 'selected' : ''}>Planned</option>
                <option value="Purchased" ${gift.status === 'Purchased' ? 'selected' : ''}>Purchased</option>
                <option value="Gifted" ${gift.status === 'Gifted' ? 'selected' : ''}>Gifted</option>
              </select>
            </div>

            <div class="gift-title-row">
              <h3 class="gift-name">${escapeHTML(gift.name)}</h3>
              ${gift.link ? `
                <a href="${escapeHTML(gift.link)}" target="_blank" rel="noopener noreferrer" class="gift-link-icon" title="Open product link in new tab">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </a>
              ` : ''}
            </div>

            <div class="gift-recipient-info" onclick="GiftlyApp.openRecipientProfileModal('${recipient.id}')" style="cursor: pointer;" title="View recipient profile">
              <div class="avatar avatar-sm ${avatarColor}">${initials}</div>
              <span style="font-size: 0.84rem; font-weight: 600; color: var(--color-text);">${escapeHTML(recipient.name)}</span>
            </div>

            <div class="gift-budget-box">
              <span class="gift-budget-label">Estimated Budget</span>
              <span class="gift-budget-amount">${formatNaira(gift.budget)}</span>
            </div>

            ${gift.description ? `
              <p class="gift-description-text">${escapeHTML(gift.description)}</p>
            ` : '<div style="flex: 1;"></div>'}

            <div class="gift-card-footer">
              <span style="font-size: 0.78rem; color: var(--color-text-muted);">
                Status: <strong style="color: var(--color-text);">${escapeHTML(gift.status)}</strong>
              </span>

              <div style="display: flex; gap: 0.35rem;">
                <button class="btn-icon" onclick="GiftlyApp.editGift('${gift.id}')" title="Edit gift">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button class="btn-icon btn-icon-danger" onclick="GiftlyApp.confirmDeleteGift('${gift.id}')" title="Delete gift">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    },

    resetGiftsFilters() {
      const search = document.getElementById('search-gifts');
      const status = document.getElementById('filter-gifts-status');
      const occ = document.getElementById('filter-gifts-occasion');
      const rec = document.getElementById('filter-gifts-recipient');
      const sort = document.getElementById('sort-gifts');
      if (search) search.value = '';
      if (status) status.value = '';
      if (occ) occ.value = '';
      if (rec) rec.value = '';
      if (sort) sort.value = 'date-desc';
      this.renderGifts();
    },

    handleStatusChange(giftId, newStatus) {
      DataStore.updateGiftStatus(giftId, newStatus);
      this.showToast(`Gift status updated to "${newStatus}"`, 'success');
      this.updateAllViews();
    },

    /* ===================================================================
       5. OCCASIONS VIEW CONTROLLER
       =================================================================== */

    renderOccasions() {
      const container = document.getElementById('occasions-grid');
      if (!container) return;

      const occasions = DataStore.getOccasions();
      const recipients = DataStore.getRecipients();

      const searchVal = (document.getElementById('search-occasions')?.value || '').trim().toLowerCase();
      const filterType = document.getElementById('filter-occasions-type')?.value || '';
      const filterRec = document.getElementById('filter-occasions-recipient')?.value || '';

      // Clear search button visibility
      const clearBtn = document.getElementById('clear-search-occasions');
      if (clearBtn) clearBtn.classList.toggle('hidden', searchVal.length === 0);

      let filtered = occasions.filter(o => {
        const recipient = recipients.find(r => r.id === o.recipientId);
        const recipientName = recipient ? recipient.name.toLowerCase() : '';
        const matchesSearch = !searchVal ||
          o.name.toLowerCase().includes(searchVal) ||
          recipientName.includes(searchVal) ||
          (o.notes && o.notes.toLowerCase().includes(searchVal));
        const matchesType = !filterType || o.type === filterType;
        const matchesRec = !filterRec || o.recipientId === filterRec;
        return matchesSearch && matchesType && matchesRec;
      });

      // Calculate countdown and sort chronologically by upcoming date
      const enriched = filtered.map(occ => {
        const recipient = recipients.find(r => r.id === occ.recipientId) || { name: 'Unknown Recipient', id: '' };
        const countdown = calculateOccasionCountdown(occ.date, occ.type);
        return { occ, recipient, countdown };
      });

      enriched.sort((a, b) => a.countdown.diffDays - b.countdown.diffDays);

      if (enriched.length === 0) {
        if (occasions.length === 0) {
          container.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon-wrap">
                <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
              <h3 class="empty-title">Never miss a meaningful moment.</h3>
              <p class="empty-desc">Add birthdays, anniversaries and other special occasions so you can plan thoughtful surprises ahead of time.</p>
              <button class="btn btn-primary" onclick="GiftlyApp.openOccasionModal()">Add Your First Occasion</button>
            </div>
          `;
        } else {
          container.innerHTML = `
            <div class="empty-state">
              <h3 class="empty-title">No occasions match your criteria</h3>
              <p class="empty-desc">Try clearing your filters to see all upcoming dates.</p>
              <button class="btn btn-secondary btn-sm" onclick="GiftlyApp.resetOccasionsFilters()">Clear Filters</button>
            </div>
          `;
        }
        return;
      }

      container.innerHTML = enriched.map(({ occ, recipient, countdown }) => {
        const initials = getInitials(recipient.name);
        const avatarColor = getAvatarColorClass(recipient.name);

        return `
          <div class="content-card occasion-card" id="card-occ-${occ.id}">
            <div class="occasion-card-header">
              <div class="occasion-date-box">
                <span class="occasion-day-name">${countdown.dayOfWeek} &bull; ${countdown.targetDateStr}</span>
                <span class="badge ${countdown.badgeClass}" style="margin-top: 0.35rem; align-self: flex-start;">${countdown.label}</span>
              </div>
              <span class="badge badge-subtle">${escapeHTML(occ.type)}</span>
            </div>

            <h3 class="occasion-name">${escapeHTML(occ.name)}</h3>

            <div class="occasion-person" onclick="GiftlyApp.openRecipientProfileModal('${recipient.id}')" style="cursor: pointer;" title="View recipient profile">
              <div class="avatar avatar-sm ${avatarColor}">${initials}</div>
              <span style="font-size: 0.84rem; font-weight: 600; color: var(--color-text);">${escapeHTML(recipient.name)}</span>
            </div>

            ${occ.notes ? `
              <div class="occasion-notes-box">
                ${escapeHTML(occ.notes)}
              </div>
            ` : '<div style="flex: 1;"></div>'}

            <div class="occasion-card-footer">
              <button class="btn btn-secondary btn-sm" onclick="GiftlyApp.planGiftForOccasion('${occ.id}')">
                + Plan Gift
              </button>

              <div style="display: flex; gap: 0.35rem;">
                <button class="btn-icon" onclick="GiftlyApp.editOccasion('${occ.id}')" title="Edit occasion">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button class="btn-icon btn-icon-danger" onclick="GiftlyApp.confirmDeleteOccasion('${occ.id}')" title="Delete occasion">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    },

    resetOccasionsFilters() {
      const search = document.getElementById('search-occasions');
      const type = document.getElementById('filter-occasions-type');
      const rec = document.getElementById('filter-occasions-recipient');
      if (search) search.value = '';
      if (type) type.value = '';
      if (rec) rec.value = '';
      this.renderOccasions();
    },

    // Plan Gift for Occasion shortcut
    planGiftForOccasion(occId) {
      const occ = DataStore.getOccasionById(occId);
      if (!occ) return;

      this.openGiftModal({
        name: '',
        recipientId: occ.recipientId,
        occasion: occ.type,
        budget: '',
        status: 'Planned',
        description: `For occasion: ${occ.name}`
      });
    },

    /* ===================================================================
       SEARCH AND FILTERS EVENT BINDINGS
       =================================================================== */

    bindSearchAndFilters() {
      const self = this;

      // People Search & Filter
      const searchPeople = document.getElementById('search-people');
      const filterPeopleRel = document.getElementById('filter-people-relationship');
      const clearSearchPeople = document.getElementById('clear-search-people');

      if (searchPeople) searchPeople.addEventListener('input', () => self.renderPeople());
      if (filterPeopleRel) filterPeopleRel.addEventListener('change', () => self.renderPeople());
      if (clearSearchPeople) {
        clearSearchPeople.addEventListener('click', () => {
          searchPeople.value = '';
          self.renderPeople();
          searchPeople.focus();
        });
      }

      // Notes Search & Filter
      const searchNotes = document.getElementById('search-notes');
      const filterNotesRec = document.getElementById('filter-notes-recipient');
      const filterNotesCat = document.getElementById('filter-notes-category');
      const sortNotes = document.getElementById('sort-notes');
      const clearSearchNotes = document.getElementById('clear-search-notes');

      if (searchNotes) searchNotes.addEventListener('input', () => self.renderNotes());
      if (filterNotesRec) filterNotesRec.addEventListener('change', () => self.renderNotes());
      if (filterNotesCat) filterNotesCat.addEventListener('change', () => self.renderNotes());
      if (sortNotes) sortNotes.addEventListener('change', () => self.renderNotes());
      if (clearSearchNotes) {
        clearSearchNotes.addEventListener('click', () => {
          searchNotes.value = '';
          self.renderNotes();
          searchNotes.focus();
        });
      }

      // Gifts Search & Filter
      const searchGifts = document.getElementById('search-gifts');
      const filterGiftsStatus = document.getElementById('filter-gifts-status');
      const filterGiftsOcc = document.getElementById('filter-gifts-occasion');
      const filterGiftsRec = document.getElementById('filter-gifts-recipient');
      const sortGifts = document.getElementById('sort-gifts');
      const clearSearchGifts = document.getElementById('clear-search-gifts');

      if (searchGifts) searchGifts.addEventListener('input', () => self.renderGifts());
      if (filterGiftsStatus) filterGiftsStatus.addEventListener('change', () => self.renderGifts());
      if (filterGiftsOcc) filterGiftsOcc.addEventListener('change', () => self.renderGifts());
      if (filterGiftsRec) filterGiftsRec.addEventListener('change', () => self.renderGifts());
      if (sortGifts) sortGifts.addEventListener('change', () => self.renderGifts());
      if (clearSearchGifts) {
        clearSearchGifts.addEventListener('click', () => {
          searchGifts.value = '';
          self.renderGifts();
          searchGifts.focus();
        });
      }

      // Occasions Search & Filter
      const searchOcc = document.getElementById('search-occasions');
      const filterOccType = document.getElementById('filter-occasions-type');
      const filterOccRec = document.getElementById('filter-occasions-recipient');
      const clearSearchOcc = document.getElementById('clear-search-occasions');

      if (searchOcc) searchOcc.addEventListener('input', () => self.renderOccasions());
      if (filterOccType) filterOccType.addEventListener('change', () => self.renderOccasions());
      if (filterOccRec) filterOccRec.addEventListener('change', () => self.renderOccasions());
      if (clearSearchOcc) {
        clearSearchOcc.addEventListener('click', () => {
          searchOcc.value = '';
          self.renderOccasions();
          searchOcc.focus();
        });
      }
    },

    /* ===================================================================
       MODAL CONTROLLERS & FORM HANDLING
       =================================================================== */

    openModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        // Prevent background scrolling while modal is open
        document.body.style.overflow = 'hidden';
      }
    },

    closeModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        // Restore body scroll if no other active modal
        const anyActive = document.querySelector('.modal-backdrop.active');
        if (!anyActive) {
          document.body.style.overflow = '';
        }
      }
    },

    bindGlobalKeyboard() {
      const self = this;
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          // Close top-most active modal
          const activeModals = document.querySelectorAll('.modal-backdrop.active');
          if (activeModals.length > 0) {
            const topModal = activeModals[activeModals.length - 1];
            self.closeModal(topModal.id);
          }
          self.closeMobileMenu();
        }
      });

      // Close modal on backdrop click
      document.querySelectorAll('.modal-backdrop').forEach(modal => {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            self.closeModal(modal.id);
          }
        });
      });
    },

    // --- 1. RECIPIENT MODAL ---
    openRecipientModal(data = null) {
      const form = document.getElementById('form-recipient');
      if (form) form.reset();
      this.clearFormErrors('form-recipient');

      const titleEl = document.getElementById('modal-recipient-title');
      const idInput = document.getElementById('recipient-id');

      if (data && data.id) {
        if (titleEl) titleEl.textContent = 'Edit Recipient';
        if (idInput) idInput.value = data.id;
        document.getElementById('recipient-name').value = data.name || '';
        document.getElementById('recipient-relationship').value = data.relationship || '';
        document.getElementById('recipient-favourite-colour').value = data.favouriteColour || '';
        document.getElementById('recipient-interests').value = data.interests || '';
        document.getElementById('recipient-favourite-things').value = data.favouriteThings || '';
        document.getElementById('recipient-notes').value = data.notes || '';
      } else {
        if (titleEl) titleEl.textContent = 'Add Recipient';
        if (idInput) idInput.value = '';
      }

      this.openModal('modal-recipient');
      setTimeout(() => document.getElementById('recipient-name')?.focus(), 100);
    },

    editRecipient(id) {
      const r = DataStore.getRecipientById(id);
      if (r) this.openRecipientModal(r);
    },

    // --- 2. THOUGHT NOTE MODAL ---
    openNoteModal(data = null) {
      const form = document.getElementById('form-note');
      if (form) form.reset();
      this.clearFormErrors('form-note');
      this.populateRecipientSelects();

      const titleEl = document.getElementById('modal-note-title');
      const idInput = document.getElementById('note-id');
      const dateInput = document.getElementById('note-date');

      if (data && data.id) {
        if (titleEl) titleEl.textContent = 'Edit Thought Note';
        if (idInput) idInput.value = data.id;
        document.getElementById('note-title').value = data.title || '';
        document.getElementById('note-recipient').value = data.recipientId || '';
        document.getElementById('note-category').value = data.category || '';
        if (dateInput) dateInput.value = data.date || '';
        document.getElementById('note-description').value = data.description || '';
      } else {
        if (titleEl) titleEl.textContent = 'Add Thought Note';
        if (idInput) idInput.value = '';
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        if (data && data.recipientId) {
          document.getElementById('note-recipient').value = data.recipientId;
        }
      }

      this.openModal('modal-note');
      setTimeout(() => document.getElementById('note-title')?.focus(), 100);
    },

    editNote(id) {
      const n = DataStore.getNoteById(id);
      if (n) this.openNoteModal(n);
    },

    // --- 3. GIFT MODAL ---
    openGiftModal(data = null) {
      const form = document.getElementById('form-gift');
      if (form) form.reset();
      this.clearFormErrors('form-gift');
      this.populateRecipientSelects();

      const titleEl = document.getElementById('modal-gift-title');
      const idInput = document.getElementById('gift-id');

      if (data && data.id) {
        if (titleEl) titleEl.textContent = 'Edit Gift Idea';
        if (idInput) idInput.value = data.id;
        document.getElementById('gift-name').value = data.name || '';
        document.getElementById('gift-recipient').value = data.recipientId || '';
        document.getElementById('gift-occasion').value = data.occasion || '';
        document.getElementById('gift-budget').value = data.budget !== undefined ? data.budget : '';
        document.getElementById('gift-status').value = data.status || 'Planned';
        document.getElementById('gift-link').value = data.link || '';
        document.getElementById('gift-description').value = data.description || '';
      } else {
        if (titleEl) titleEl.textContent = 'Add Gift Idea';
        if (idInput) idInput.value = '';
        document.getElementById('gift-status').value = 'Planned';
        if (data) {
          if (data.name) document.getElementById('gift-name').value = data.name;
          if (data.recipientId) document.getElementById('gift-recipient').value = data.recipientId;
          if (data.occasion) document.getElementById('gift-occasion').value = data.occasion;
          if (data.budget) document.getElementById('gift-budget').value = data.budget;
          if (data.status) document.getElementById('gift-status').value = data.status;
          if (data.description) document.getElementById('gift-description').value = data.description;
        }
      }

      this.openModal('modal-gift');
      setTimeout(() => document.getElementById('gift-name')?.focus(), 100);
    },

    editGift(id) {
      const g = DataStore.getGiftById(id);
      if (g) this.openGiftModal(g);
    },

    // --- 4. OCCASION MODAL ---
    openOccasionModal(data = null) {
      const form = document.getElementById('form-occasion');
      if (form) form.reset();
      this.clearFormErrors('form-occasion');
      this.populateRecipientSelects();

      const titleEl = document.getElementById('modal-occasion-title');
      const idInput = document.getElementById('occasion-id');

      if (data && data.id) {
        if (titleEl) titleEl.textContent = 'Edit Occasion';
        if (idInput) idInput.value = data.id;
        document.getElementById('occasion-name').value = data.name || '';
        document.getElementById('occasion-recipient').value = data.recipientId || '';
        document.getElementById('occasion-type').value = data.type || '';
        document.getElementById('occasion-date').value = data.date || '';
        document.getElementById('occasion-notes').value = data.notes || '';
      } else {
        if (titleEl) titleEl.textContent = 'Add Occasion';
        if (idInput) idInput.value = '';
        if (data && data.recipientId) {
          document.getElementById('occasion-recipient').value = data.recipientId;
        }
      }

      this.openModal('modal-occasion');
      setTimeout(() => document.getElementById('occasion-name')?.focus(), 100);
    },

    editOccasion(id) {
      const o = DataStore.getOccasionById(id);
      if (o) this.openOccasionModal(o);
    },

    // --- 5. RECIPIENT PROFILE DETAIL MODAL ---
    openRecipientProfileModal(recipientId) {
      const recipient = DataStore.getRecipientById(recipientId);
      if (!recipient) return;

      const initials = getInitials(recipient.name);
      const avatarColor = getAvatarColorClass(recipient.name);

      const avatarEl = document.getElementById('profile-avatar');
      if (avatarEl) {
        avatarEl.className = `avatar avatar-large ${avatarColor}`;
        avatarEl.textContent = initials;
      }

      const nameEl = document.getElementById('profile-name');
      const relEl = document.getElementById('profile-relationship');
      if (nameEl) nameEl.textContent = recipient.name;
      if (relEl) relEl.textContent = recipient.relationship;

      const editBtn = document.getElementById('profile-edit-btn');
      if (editBtn) {
        editBtn.onclick = () => {
          this.closeModal('modal-recipient-profile');
          this.editRecipient(recipient.id);
        };
      }

      // Metadata preferences
      const colEl = document.getElementById('profile-colour');
      const intEl = document.getElementById('profile-interests');
      const favEl = document.getElementById('profile-favourite-things');
      const notesEl = document.getElementById('profile-notes');

      if (colEl) colEl.textContent = recipient.favouriteColour || 'Not specified';
      if (intEl) intEl.textContent = recipient.interests || 'None specified yet.';
      if (favEl) favEl.textContent = recipient.favouriteThings || 'None specified yet.';
      if (notesEl) notesEl.textContent = recipient.notes || 'None specified yet.';

      // Connected Thought Notes
      const notes = DataStore.getNotesForRecipient(recipient.id);
      const notesCountEl = document.getElementById('profile-notes-count');
      const notesListEl = document.getElementById('profile-notes-list');
      if (notesCountEl) notesCountEl.textContent = notes.length;
      if (notesListEl) {
        if (notes.length === 0) {
          notesListEl.innerHTML = '<p style="font-size: 0.84rem; color: var(--color-text-muted); font-style: italic;">No thought notes recorded for this person yet.</p>';
        } else {
          notesListEl.innerHTML = notes.map(n => `
            <div class="profile-subitem">
              <div>
                <strong>${escapeHTML(n.title)}</strong>
                <p style="font-size: 0.78rem; color: var(--color-text-muted);">"${escapeHTML(n.description.substring(0, 60))}${n.description.length > 60 ? '...' : ''}"</p>
              </div>
              <span class="badge ${getCategoryBadgeClass(n.category)}" style="font-size: 0.7rem;">${escapeHTML(n.category)}</span>
            </div>
          `).join('');
        }
      }

      const addNoteBtn = document.getElementById('profile-add-note-btn');
      if (addNoteBtn) {
        addNoteBtn.onclick = () => {
          this.closeModal('modal-recipient-profile');
          this.openNoteModal({ recipientId: recipient.id });
        };
      }

      // Connected Gifts
      const gifts = DataStore.getGiftsForRecipient(recipient.id);
      const giftsCountEl = document.getElementById('profile-gifts-count');
      const giftsListEl = document.getElementById('profile-gifts-list');
      if (giftsCountEl) giftsCountEl.textContent = gifts.length;
      if (giftsListEl) {
        if (gifts.length === 0) {
          giftsListEl.innerHTML = '<p style="font-size: 0.84rem; color: var(--color-text-muted); font-style: italic;">No gift ideas saved for this person yet.</p>';
        } else {
          giftsListEl.innerHTML = gifts.map(g => `
            <div class="profile-subitem">
              <div>
                <strong>${escapeHTML(g.name)}</strong>
                <span style="font-size: 0.78rem; color: var(--color-text-muted); display: block;">${escapeHTML(g.occasion)} &bull; ${formatNaira(g.budget)}</span>
              </div>
              <span class="badge ${getGiftStatusBadgeClass(g.status)}" style="font-size: 0.7rem;">${escapeHTML(g.status)}</span>
            </div>
          `).join('');
        }
      }

      const addGiftBtn = document.getElementById('profile-add-gift-btn');
      if (addGiftBtn) {
        addGiftBtn.onclick = () => {
          this.closeModal('modal-recipient-profile');
          this.openGiftModal({ recipientId: recipient.id });
        };
      }

      // Connected Occasions
      const occasions = DataStore.getOccasionsForRecipient(recipient.id);
      const occCountEl = document.getElementById('profile-occasions-count');
      const occListEl = document.getElementById('profile-occasions-list');
      if (occCountEl) occCountEl.textContent = occasions.length;
      if (occListEl) {
        if (occasions.length === 0) {
          occListEl.innerHTML = '<p style="font-size: 0.84rem; color: var(--color-text-muted); font-style: italic;">No occasions saved for this person yet.</p>';
        } else {
          occListEl.innerHTML = occasions.map(o => {
            const countdown = calculateOccasionCountdown(o.date, o.type);
            return `
              <div class="profile-subitem">
                <div>
                  <strong>${escapeHTML(o.name)}</strong>
                  <span style="font-size: 0.78rem; color: var(--color-text-muted); display: block;">${countdown.targetDateStr}</span>
                </div>
                <span class="badge ${countdown.badgeClass}" style="font-size: 0.7rem;">${countdown.label}</span>
              </div>
            `;
          }).join('');
        }
      }

      const addOccBtn = document.getElementById('profile-add-occasion-btn');
      if (addOccBtn) {
        addOccBtn.onclick = () => {
          this.closeModal('modal-recipient-profile');
          this.openOccasionModal({ recipientId: recipient.id });
        };
      }

      this.openModal('modal-recipient-profile');
    },

    // --- 6. PROMISE-BASED CONFIRMATION MODAL ---
    confirmModal({ title, message, warningDetails = null, confirmText = 'Confirm Delete', isDanger = true }) {
      const self = this;
      return new Promise((resolve) => {
        const titleEl = document.getElementById('confirm-title');
        const msgEl = document.getElementById('confirm-message');
        const warnEl = document.getElementById('confirm-extra-warning');
        const proceedBtn = document.getElementById('btn-confirm-proceed');
        const cancelBtn = document.getElementById('btn-confirm-cancel');

        if (titleEl) titleEl.textContent = title || 'Confirm Action';
        if (msgEl) msgEl.textContent = message || 'Are you sure you want to proceed?';

        if (warnEl) {
          if (warningDetails) {
            warnEl.innerHTML = warningDetails;
            warnEl.classList.remove('hidden');
          } else {
            warnEl.innerHTML = '';
            warnEl.classList.add('hidden');
          }
        }

        if (proceedBtn) {
          proceedBtn.textContent = confirmText;
          proceedBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';
          // Clean previous click handler
          const newProceed = proceedBtn.cloneNode(true);
          proceedBtn.parentNode.replaceChild(newProceed, proceedBtn);
          newProceed.addEventListener('click', () => {
            self.closeModal('modal-confirm');
            resolve(true);
          });
        }

        if (cancelBtn) {
          const newCancel = cancelBtn.cloneNode(true);
          cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
          newCancel.addEventListener('click', () => {
            self.closeModal('modal-confirm');
            resolve(false);
          });
        }

        self.openModal('modal-confirm');
      });
    },

    // Delete recipient with safe cascade checking
    async confirmDeleteRecipient(id) {
      const r = DataStore.getRecipientById(id);
      if (!r) return;

      const cascade = DataStore.getRecipientCascadeCounts(id);
      let warningHtml = '';
      if (cascade.notes > 0 || cascade.gifts > 0 || cascade.occasions > 0) {
        warningHtml = `
          <strong>Important:</strong> Deleting <strong>${escapeHTML(r.name)}</strong> will also safely delete:
          <ul style="margin-top: 0.35rem; padding-left: 1.25rem;">
            ${cascade.gifts > 0 ? `<li>${cascade.gifts} gift idea(s)</li>` : ''}
            ${cascade.notes > 0 ? `<li>${cascade.notes} thought note(s)</li>` : ''}
            ${cascade.occasions > 0 ? `<li>${cascade.occasions} occasion(s)</li>` : ''}
          </ul>
          This prevents broken references and maintains data integrity.
        `;
      }

      const confirmed = await this.confirmModal({
        title: `Delete ${r.name}?`,
        message: `Are you sure you want to remove ${r.name} from your recipients? This action cannot be undone.`,
        warningDetails: warningHtml,
        confirmText: 'Delete Recipient & Records',
        isDanger: true
      });

      if (confirmed) {
        DataStore.deleteRecipient(id);
        this.showToast(`Deleted ${r.name} and related records`, 'info');
        this.updateAllViews();
      }
    },

    // Delete note
    async confirmDeleteNote(id) {
      const n = DataStore.getNoteById(id);
      if (!n) return;

      const confirmed = await this.confirmModal({
        title: 'Delete Thought Note?',
        message: `Are you sure you want to delete the note "${n.title}"?`,
        confirmText: 'Delete Note',
        isDanger: true
      });

      if (confirmed) {
        DataStore.deleteNote(id);
        this.showToast('Thought note deleted', 'info');
        this.updateAllViews();
      }
    },

    // Delete gift
    async confirmDeleteGift(id) {
      const g = DataStore.getGiftById(id);
      if (!g) return;

      const confirmed = await this.confirmModal({
        title: 'Delete Gift Idea?',
        message: `Are you sure you want to delete "${g.name}" from your Gift Vault?`,
        confirmText: 'Delete Gift',
        isDanger: true
      });

      if (confirmed) {
        DataStore.deleteGift(id);
        this.showToast('Gift idea removed from vault', 'info');
        this.updateAllViews();
      }
    },

    // Delete occasion
    async confirmDeleteOccasion(id) {
      const o = DataStore.getOccasionById(id);
      if (!o) return;

      const confirmed = await this.confirmModal({
        title: 'Delete Occasion?',
        message: `Are you sure you want to delete "${o.name}"?`,
        confirmText: 'Delete Occasion',
        isDanger: true
      });

      if (confirmed) {
        DataStore.deleteOccasion(id);
        this.showToast('Occasion deleted', 'info');
        this.updateAllViews();
      }
    },

    /* ===================================================================
       FORM SUBMISSION & VALIDATION
       =================================================================== */

    clearFormErrors(formId) {
      const form = document.getElementById(formId);
      if (!form) return;
      form.querySelectorAll('.form-error').forEach(el => el.textContent = '');
      form.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    },

    setFieldError(fieldId, errorMsg) {
      const field = document.getElementById(fieldId);
      const errorSpan = document.getElementById(`error-${fieldId}`);
      if (field) field.classList.add('input-error');
      if (errorSpan) errorSpan.textContent = errorMsg;
    },

    bindForms() {
      const self = this;

      // 1. Recipient Form Submission
      const formRecipient = document.getElementById('form-recipient');
      if (formRecipient) {
        formRecipient.addEventListener('submit', (e) => {
          e.preventDefault();
          self.clearFormErrors('form-recipient');

          const nameInput = document.getElementById('recipient-name');
          const relInput = document.getElementById('recipient-relationship');
          const nameVal = nameInput ? nameInput.value.trim() : '';
          const relVal = relInput ? relInput.value.trim() : '';

          let hasError = false;
          if (!nameVal) {
            self.setFieldError('recipient-name', 'Full name is required.');
            hasError = true;
          }
          if (!relVal) {
            self.setFieldError('recipient-relationship', 'Please select a relationship.');
            hasError = true;
          }

          if (hasError) return;

          // Prevent duplicate submissions
          const submitBtn = document.getElementById('btn-save-recipient');
          if (submitBtn) submitBtn.disabled = true;

          const id = document.getElementById('recipient-id').value;
          const isEdit = Boolean(id);

          const payload = {
            id: id || undefined,
            name: nameVal,
            relationship: relVal,
            favouriteColour: document.getElementById('recipient-favourite-colour').value.trim(),
            interests: document.getElementById('recipient-interests').value.trim(),
            favouriteThings: document.getElementById('recipient-favourite-things').value.trim(),
            notes: document.getElementById('recipient-notes').value.trim()
          };

          DataStore.saveRecipient(payload);
          if (submitBtn) submitBtn.disabled = false;

          self.closeModal('modal-recipient');
          self.showToast(isEdit ? 'Recipient updated successfully' : 'New recipient added', 'success');
          self.updateAllViews();
        });
      }

      // 2. Thought Note Form Submission
      const formNote = document.getElementById('form-note');
      if (formNote) {
        formNote.addEventListener('submit', (e) => {
          e.preventDefault();
          self.clearFormErrors('form-note');

          const titleVal = document.getElementById('note-title').value.trim();
          const recipientVal = document.getElementById('note-recipient').value;
          const categoryVal = document.getElementById('note-category').value;
          const dateVal = document.getElementById('note-date').value;
          const descVal = document.getElementById('note-description').value.trim();

          let hasError = false;
          if (!titleVal) {
            self.setFieldError('note-title', 'Note title is required.');
            hasError = true;
          }
          if (!recipientVal) {
            self.setFieldError('note-recipient', 'Please select a recipient.');
            hasError = true;
          }
          if (!categoryVal) {
            self.setFieldError('note-category', 'Please choose a category.');
            hasError = true;
          }
          if (!dateVal) {
            self.setFieldError('note-date', 'Date captured is required.');
            hasError = true;
          }
          if (!descVal) {
            self.setFieldError('note-description', 'Description cannot be empty.');
            hasError = true;
          }

          if (hasError) return;

          const submitBtn = document.getElementById('btn-save-note');
          if (submitBtn) submitBtn.disabled = true;

          const id = document.getElementById('note-id').value;
          const isEdit = Boolean(id);

          const payload = {
            id: id || undefined,
            title: titleVal,
            recipientId: recipientVal,
            category: categoryVal,
            date: dateVal,
            description: descVal
          };

          DataStore.saveNote(payload);
          if (submitBtn) submitBtn.disabled = false;

          self.closeModal('modal-note');
          self.showToast(isEdit ? 'Thought note updated' : 'Thought note recorded', 'success');
          self.updateAllViews();
        });
      }

      // 3. Gift Vault Form Submission
      const formGift = document.getElementById('form-gift');
      if (formGift) {
        formGift.addEventListener('submit', (e) => {
          e.preventDefault();
          self.clearFormErrors('form-gift');

          const nameVal = document.getElementById('gift-name').value.trim();
          const recipientVal = document.getElementById('gift-recipient').value;
          const occasionVal = document.getElementById('gift-occasion').value;
          const budgetVal = document.getElementById('gift-budget').value.trim();
          const statusVal = document.getElementById('gift-status').value;
          const linkVal = document.getElementById('gift-link').value.trim();
          const descVal = document.getElementById('gift-description').value.trim();

          let hasError = false;
          if (!nameVal) {
            self.setFieldError('gift-name', 'Gift name is required.');
            hasError = true;
          }
          if (!recipientVal) {
            self.setFieldError('gift-recipient', 'Please choose a recipient.');
            hasError = true;
          }
          if (!occasionVal) {
            self.setFieldError('gift-occasion', 'Please select an occasion.');
            hasError = true;
          }
          if (budgetVal === '' || isNaN(budgetVal) || Number(budgetVal) < 0) {
            self.setFieldError('gift-budget', 'Enter a valid non-negative estimated budget.');
            hasError = true;
          }
          if (!statusVal) {
            self.setFieldError('gift-status', 'Select a gift status.');
            hasError = true;
          }

          if (hasError) return;

          const submitBtn = document.getElementById('btn-save-gift');
          if (submitBtn) submitBtn.disabled = true;

          const id = document.getElementById('gift-id').value;
          const isEdit = Boolean(id);

          const payload = {
            id: id || undefined,
            name: nameVal,
            recipientId: recipientVal,
            occasion: occasionVal,
            budget: Number(budgetVal),
            status: statusVal,
            link: linkVal,
            description: descVal
          };

          DataStore.saveGift(payload);
          if (submitBtn) submitBtn.disabled = false;

          self.closeModal('modal-gift');
          self.showToast(isEdit ? 'Gift idea updated' : 'Gift idea added to vault', 'success');
          self.updateAllViews();
        });
      }

      // 4. Occasion Form Submission
      const formOccasion = document.getElementById('form-occasion');
      if (formOccasion) {
        formOccasion.addEventListener('submit', (e) => {
          e.preventDefault();
          self.clearFormErrors('form-occasion');

          const nameVal = document.getElementById('occasion-name').value.trim();
          const recipientVal = document.getElementById('occasion-recipient').value;
          const typeVal = document.getElementById('occasion-type').value;
          const dateVal = document.getElementById('occasion-date').value;
          const notesVal = document.getElementById('occasion-notes').value.trim();

          let hasError = false;
          if (!nameVal) {
            self.setFieldError('occasion-name', 'Occasion name is required.');
            hasError = true;
          }
          if (!recipientVal) {
            self.setFieldError('occasion-recipient', 'Please select a recipient.');
            hasError = true;
          }
          if (!typeVal) {
            self.setFieldError('occasion-type', 'Please select an occasion type.');
            hasError = true;
          }
          if (!dateVal) {
            self.setFieldError('occasion-date', 'Please choose a valid date.');
            hasError = true;
          }

          if (hasError) return;

          const submitBtn = document.getElementById('btn-save-occasion');
          if (submitBtn) submitBtn.disabled = true;

          const id = document.getElementById('occasion-id').value;
          const isEdit = Boolean(id);

          const payload = {
            id: id || undefined,
            name: nameVal,
            recipientId: recipientVal,
            type: typeVal,
            date: dateVal,
            notes: notesVal
          };

          DataStore.saveOccasion(payload);
          if (submitBtn) submitBtn.disabled = false;

          self.closeModal('modal-occasion');
          self.showToast(isEdit ? 'Occasion updated' : 'Occasion saved', 'success');
          self.updateAllViews();
        });
      }
    },

    /* ===================================================================
       TOAST NOTIFICATION SYSTEM
       =================================================================== */

    showToast(message, type = 'info', title = null) {
      const container = document.getElementById('toast-container');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;

      let iconSvg = '';
      if (type === 'success') {
        iconSvg = `
          <svg class="toast-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        `;
      } else if (type === 'error') {
        iconSvg = `
          <svg class="toast-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        `;
      } else {
        iconSvg = `
          <svg class="toast-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        `;
      }

      const defaultTitle = type === 'success' ? 'Success' : type === 'error' ? 'Notice' : 'Updated';

      toast.innerHTML = `
        ${iconSvg}
        <div class="toast-content">
          <div class="toast-title">${escapeHTML(title || defaultTitle)}</div>
          <div class="toast-msg">${escapeHTML(message)}</div>
        </div>
      `;

      container.appendChild(toast);

      // Dismiss automatically after 3.2 seconds
      setTimeout(() => {
        toast.classList.add('toast-hiding');
        setTimeout(() => {
          if (typeof toast.remove === 'function') {
            toast.remove();
          } else if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 250);
      }, 3200);
    }
  };

  // Expose to global window for inline onclick handlers
  window.GiftlyApp = GiftlyApp;

  // Launch when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => GiftlyApp.init());
  } else {
    GiftlyApp.init();
  }

})();
