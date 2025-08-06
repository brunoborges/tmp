// IBM TechXchange Analytics Dashboard JavaScript

class EventAnalyticsDashboard {
    constructor() {
        this.analyticsData = null;
        this.talksData = null;
        this.currentPage = 1;
        this.talksPerPage = 12;
        this.charts = {};
        this.init();
    }

    async init() {
        try {
            await this.loadAnalytics();
            this.renderDashboard();
            this.setupEventListeners();
            this.hideLoading();
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
            this.showError('Failed to load analytics data');
        }
    }

    async loadAnalytics() {
        const response = await fetch('/api/analytics');
        const result = await response.json();
        if (result.success) {
            this.analyticsData = result.data;
        } else {
            throw new Error(result.error);
        }
    }

    async loadTalks(filters = {}) {
        const params = new URLSearchParams({
            page: this.currentPage,
            limit: this.talksPerPage,
            ...filters
        });
        
        const response = await fetch(`/api/talks?${params}`);
        const result = await response.json();
        if (result.success) {
            this.talksData = result.data;
            this.renderTalks();
            this.renderPagination();
        } else {
            throw new Error(result.error);
        }
    }

    renderDashboard() {
        this.renderOverviewCards();
        this.renderCharts();
        this.renderAnalysisCards();
        this.renderWordCloud();
        this.loadTalks();
    }

    renderOverviewCards() {
        const { basicStats, speakers, schedule } = this.analyticsData;
        
        document.getElementById('total-talks').textContent = basicStats.totalTalks;
        document.getElementById('total-speakers').textContent = speakers.totalSpeakers;
        document.getElementById('total-companies').textContent = speakers.totalCompanies;
        document.getElementById('avg-parallel').textContent = schedule.avgParallelSessions;
    }

    renderCharts() {
        this.renderTalkTypesChart();
        this.renderScheduleChart();
        this.renderSpeakerDistChart();
        this.renderCompaniesChart();
    }

    renderTalkTypesChart() {
        const { talkTypes } = this.analyticsData.basicStats;
        const ctx = document.getElementById('talkTypesChart').getContext('2d');
        
        const data = Object.entries(talkTypes);
        const colors = this.generateColors(data.length);
        
        this.charts.talkTypes = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(([type]) => type),
                datasets: [{
                    data: data.map(([, count]) => count),
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    renderScheduleChart() {
        const { byDay } = this.analyticsData.schedule;
        const ctx = document.getElementById('scheduleChart').getContext('2d');
        
        const data = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b));
        
        this.charts.schedule = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(([date]) => this.formatDate(date)),
                datasets: [{
                    label: 'Number of Talks',
                    data: data.map(([, count]) => count),
                    backgroundColor: '#0f62fe',
                    borderColor: '#0043ce',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    renderSpeakerDistChart() {
        const { speakerTalkDistribution } = this.analyticsData.speakers;
        const ctx = document.getElementById('speakerDistChart').getContext('2d');
        
        const data = Object.entries(speakerTalkDistribution)
            .sort(([a], [b]) => parseInt(a) - parseInt(b));
        
        this.charts.speakerDist = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(([talks]) => `${talks} talk${talks > 1 ? 's' : ''}`),
                datasets: [{
                    label: 'Number of Speakers',
                    data: data.map(([, count]) => count),
                    backgroundColor: '#4589ff',
                    borderColor: '#0f62fe',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    renderCompaniesChart() {
        const { companies } = this.analyticsData.speakers;
        const ctx = document.getElementById('companiesChart').getContext('2d');
        
        const topCompanies = companies.slice(0, 10);
        
        this.charts.companies = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topCompanies.map(company => this.truncateText(company.name, 20)),
                datasets: [{
                    label: 'Number of Talks',
                    data: topCompanies.map(company => company.count),
                    backgroundColor: '#24a148',
                    borderColor: '#1e8f3f',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    renderAnalysisCards() {
        this.renderTimeSlots();
        this.renderTopSpeakers();
        this.renderTechKeywords();
        this.renderRoomStats();
    }

    renderTimeSlots() {
        const { byDay, parallelSessions } = this.analyticsData.schedule;
        const container = document.getElementById('timeSlots');
        
        // Group time slots by day
        const timeSlotsByDay = {};
        
        // Process parallel sessions to get time slots per day
        Object.keys(parallelSessions).forEach(dayTimeKey => {
            const [date, timeSlot] = dayTimeKey.split('_');
            if (!timeSlotsByDay[date]) {
                timeSlotsByDay[date] = new Set();
            }
            timeSlotsByDay[date].add(timeSlot);
        });
        
        // Convert to array and sort by date, then get top days
        const sortedDays = Object.entries(timeSlotsByDay)
            .map(([date, timeSlots]) => ({
                date: date,
                timeSlotCount: timeSlots.size,
                talkCount: byDay[date] || 0,
                formattedDate: this.formatDate(date)
            }))
            .sort((a, b) => b.timeSlotCount - a.timeSlotCount)
            .slice(0, 10);
        
        container.innerHTML = sortedDays.map(day => `
            <div class="list-item clickable-day" data-date="${day.date}" style="cursor: pointer;">
                <div class="list-item-content">
                    <div class="list-item-title">${day.formattedDate}</div>
                    <div class="list-item-subtitle">${day.talkCount} talks</div>
                </div>
                <div class="list-item-count">${day.timeSlotCount}</div>
            </div>
        `).join('');
        
        // Set up click listeners for days
        this.setupDayClickListeners();
    }

    renderTopSpeakers() {
        const { speakers } = this.analyticsData.speakers;
        const container = document.getElementById('topSpeakers');
        
        const topSpeakers = speakers.slice(0, 10);
        
        container.innerHTML = topSpeakers.map(speaker => `
            <div class="list-item">
                <div class="list-item-content">
                    <div class="list-item-title">${speaker.name}</div>
                    <div class="list-item-subtitle">${speaker.company}</div>
                </div>
                <div class="list-item-count">${speaker.talkCount}</div>
            </div>
        `).join('');
    }

    renderTechKeywords() {
        const { topTechnologies } = this.analyticsData.topics;
        const container = document.getElementById('techKeywords');
        
        const topTech = topTechnologies.slice(0, 20);
        
        container.innerHTML = topTech.map(({ tech, count }) => `
            <div class="tag">
                ${tech}
                <span class="tag-count">${count}</span>
            </div>
        `).join('');
    }

    renderRoomStats() {
        const { rooms } = this.analyticsData.rooms;
        const container = document.getElementById('roomStats');
        
        const topRooms = rooms.slice(0, 10);
        
        container.innerHTML = topRooms.map(room => `
            <div class="list-item">
                <div class="list-item-content">
                    <div class="list-item-title">${this.truncateText(room.name, 30)}</div>
                    <div class="list-item-subtitle">Capacity: ${room.capacity || 'N/A'}</div>
                </div>
                <div class="list-item-count">${room.sessionCount}</div>
            </div>
        `).join('');
    }

    renderWordCloud() {
        const { topWords } = this.analyticsData.topics;
        const container = document.getElementById('wordCloud');
        
        const maxCount = Math.max(...topWords.map(w => w.count));
        const minSize = 0.8;
        const maxSize = 3;
        
        container.innerHTML = topWords.slice(0, 50).map(({ word, count }) => {
            const size = minSize + (maxSize - minSize) * (count / maxCount);
            const opacity = 0.6 + 0.4 * (count / maxCount);
            
            return `
                <span class="word-cloud-item" 
                      style="font-size: ${size}rem; opacity: ${opacity}; color: hsl(${Math.random() * 360}, 70%, 50%)"
                      title="${word}: ${count} mentions">
                    ${word}
                </span>
            `;
        }).join('');
    }

    async renderTalks() {
        const container = document.getElementById('talksGrid');
        
        if (!this.talksData || !this.talksData.talks) {
            container.innerHTML = '<p>No talks found.</p>';
            return;
        }
        
        container.innerHTML = this.talksData.talks.map(talk => `
            <div class="talk-card" data-session-id="${talk.sessionID}">
                <div class="talk-header">
                    <div class="talk-title">${talk.title}</div>
                    <div class="talk-meta">
                        <span><i class="fas fa-tag"></i> ${talk.type || 'Unknown'}</span>
                        <span><i class="fas fa-code"></i> ${talk.code}</span>
                    </div>
                </div>
                <div class="talk-body">
                    <div class="talk-abstract">
                        ${this.truncateText(this.cleanText(talk.abstract), 150)}
                    </div>
                    ${talk.participants ? `
                        <div class="talk-speakers">
                            ${talk.participants.slice(0, 3).map(p => `
                                <span class="speaker-tag">${p.fullName || p.globalFullName}</span>
                            `).join('')}
                            ${talk.participants.length > 3 ? `<span class="speaker-tag">+${talk.participants.length - 3} more</span>` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');
        
        // Add event delegation for talk card clicks
        this.setupTalkCardListeners();
    }

    renderPagination() {
        if (!this.talksData) return;
        
        const container = document.getElementById('pagination');
        const { totalPages, currentPage } = this.talksData;
        
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        
        let pagination = '';
        
        // Previous button
        pagination += `
            <button ${currentPage === 1 ? 'disabled' : ''} 
                    data-page="${currentPage - 1}">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Page numbers
        for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
            pagination += `
                <button class="${i === currentPage ? 'active' : ''}" 
                        data-page="${i}">
                    ${i}
                </button>
            `;
        }
        
        // Next button
        pagination += `
            <button ${currentPage === totalPages ? 'disabled' : ''} 
                    data-page="${currentPage + 1}">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        container.innerHTML = pagination;
        this.setupPaginationListeners();
    }

    async showTalkDetails(sessionId) {
        try {
            const response = await fetch(`/api/talk/${sessionId}`);
            const result = await response.json();
            
            if (result.success) {
                const talk = result.data;
                this.renderTalkModal(talk);
                document.getElementById('talkModal').style.display = 'block';
            }
        } catch (error) {
            console.error('Failed to load talk details:', error);
        }
    }

    renderTalkModal(talk) {
        document.getElementById('modalTitle').textContent = talk.title;
        
        const modalBody = document.getElementById('modalBody');
        modalBody.className = 'modal-body modal-scrollbar';
        modalBody.innerHTML = `
            <div class="talk-details">
                <!-- Basic Information Section -->
                <div class="detail-section">
                    <h4><i class="fas fa-info-circle"></i> Basic Information</h4>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">Session Code</div>
                            <div class="info-value">${talk.code}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Session Type</div>
                            <div class="info-value">
                                <span class="badge badge-primary">${talk.type}</span>
                            </div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Language</div>
                            <div class="info-value">${talk.language || 'English'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Duration</div>
                            <div class="info-value">${talk.length || 60} minutes</div>
                        </div>
                    </div>
                </div>
                
                ${talk.abstract ? `
                    <div class="detail-section">
                        <h4><i class="fas fa-file-text"></i> Session Abstract</h4>
                        <div class="abstract-text">${this.cleanText(talk.abstract)}</div>
                    </div>
                ` : ''}
                
                ${talk.participants && talk.participants.length > 0 ? `
                    <div class="detail-section">
                        <h4><i class="fas fa-users"></i> Speakers (${talk.participants.length})</h4>
                        <div class="detail-content">
                            ${talk.participants.map(p => `
                                <div class="speaker-card">
                                    <div class="speaker-header">
                                        <div class="speaker-avatar">
                                            ${this.getInitials(p.fullName || p.globalFullName)}
                                        </div>
                                        <div class="speaker-info">
                                            <h5>${p.fullName || p.globalFullName}</h5>
                                            <p class="speaker-title">${p.jobTitle || p.globalJobtitle || 'Speaker'}</p>
                                        </div>
                                    </div>
                                    <div class="speaker-details">
                                        <div class="info-item">
                                            <div class="info-label">Company</div>
                                            <div class="info-value">${p.companyName || p.globalCompany || 'Not specified'}</div>
                                        </div>
                                    </div>
                                    ${p.bio || p.globalBio ? `
                                        <div class="speaker-bio">
                                            ${this.cleanText(p.bio || p.globalBio)}
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                ${talk.times && talk.times.length > 0 ? `
                    <div class="detail-section">
                        <h4><i class="fas fa-calendar"></i> Schedule & Location</h4>
                        <div class="schedule-grid">
                            ${talk.times.map(time => `
                                <div class="schedule-card">
                                    <div class="schedule-header">
                                        <div class="schedule-icon">
                                            <i class="fas fa-clock"></i>
                                        </div>
                                        <div class="schedule-time">
                                            ${this.formatDate(time.date)}
                                        </div>
                                    </div>
                                    <div class="schedule-details">
                                        <div class="info-item">
                                            <div class="info-label">Time</div>
                                            <div class="info-value">${time.startTimeFormatted || time.startTime} - ${time.endTimeFormatted || time.endTime}</div>
                                        </div>
                                        <div class="info-item">
                                            <div class="info-label">Room</div>
                                            <div class="info-value">${time.room || 'TBD'}</div>
                                        </div>
                                        ${time.capacity ? `
                                            <div class="info-item">
                                                <div class="info-label">Capacity</div>
                                                <div class="info-value">${time.capacity} attendees</div>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    getInitials(name) {
        if (!name) return '?';
        return name.split(' ')
            .map(word => word.charAt(0).toUpperCase())
            .slice(0, 2)
            .join('');
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const typeFilter = document.getElementById('typeFilter');
        
        // Populate type filter
        const types = Object.keys(this.analyticsData.basicStats.talkTypes);
        typeFilter.innerHTML = '<option value="all">All Types</option>' + 
            types.map(type => `<option value="${type}">${type}</option>`).join('');
        
        // Debounced search
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.currentPage = 1;
                this.loadTalks({
                    search: searchInput.value,
                    type: typeFilter.value
                });
            }, 300);
        });
        
        typeFilter.addEventListener('change', () => {
            this.currentPage = 1;
            this.loadTalks({
                search: searchInput.value,
                type: typeFilter.value
            });
        });
        
        // Modal close on outside click
        document.getElementById('talkModal').addEventListener('click', (e) => {
            if (e.target.id === 'talkModal') {
                this.closeTalkModal();
            }
        });
        
        // Modal close button
        document.getElementById('modalCloseBtn').addEventListener('click', () => {
            this.closeTalkModal();
        });
        
        // Day details modal close events
        const dayDetailsModal = document.getElementById('dayDetailsModal');
        if (dayDetailsModal) {
            // Modal close on outside click
            dayDetailsModal.addEventListener('click', (e) => {
                if (e.target.id === 'dayDetailsModal') {
                    this.closeDayDetailsModal();
                }
            });
            
            // Modal close button
            const dayModalCloseBtn = document.getElementById('dayModalCloseBtn');
            if (dayModalCloseBtn) {
                dayModalCloseBtn.addEventListener('click', () => {
                    this.closeDayDetailsModal();
                });
            }
        }
    }

    setupTalkCardListeners() {
        const talksGrid = document.getElementById('talksGrid');
        
        // Remove any existing listeners
        if (this.handleTalkCardClick) {
            talksGrid.removeEventListener('click', this.handleTalkCardClick);
        }
        
        // Add event delegation for talk card clicks
        this.handleTalkCardClick = (event) => {
            const talkCard = event.target.closest('.talk-card');
            if (talkCard) {
                const sessionId = talkCard.getAttribute('data-session-id');
                if (sessionId) {
                    this.showTalkDetails(sessionId);
                }
            }
        };
        
        talksGrid.addEventListener('click', this.handleTalkCardClick);
    }

    setupPaginationListeners() {
        const pagination = document.getElementById('pagination');
        
        // Remove any existing listeners
        if (this.handlePaginationClick) {
            pagination.removeEventListener('click', this.handlePaginationClick);
        }
        
        // Add event delegation for pagination clicks
        this.handlePaginationClick = (event) => {
            const button = event.target.closest('button');
            if (button && !button.disabled && button.hasAttribute('data-page')) {
                const page = parseInt(button.getAttribute('data-page'));
                if (page > 0) {
                    this.changePage(page);
                }
            }
        };
        
        pagination.addEventListener('click', this.handlePaginationClick);
    }

    setupDayClickListeners() {
        const timeSlotsContainer = document.getElementById('timeSlots');
        
        // Remove any existing listeners
        if (this.handleDayClick) {
            timeSlotsContainer.removeEventListener('click', this.handleDayClick);
        }
        
        // Add event delegation for day clicks
        this.handleDayClick = (event) => {
            const dayItem = event.target.closest('.clickable-day');
            if (dayItem) {
                const date = dayItem.getAttribute('data-date');
                if (date) {
                    this.showDayDetails(date);
                }
            }
        };
        
        timeSlotsContainer.addEventListener('click', this.handleDayClick);
    }

    showDayDetails(date) {
        const { parallelSessions, byTimeSlot } = this.analyticsData.schedule;
        
        // Get all time slots for this specific day
        const dayTimeSlots = {};
        Object.keys(parallelSessions).forEach(dayTimeKey => {
            const [dayDate, timeSlot] = dayTimeKey.split('_');
            if (dayDate === date) {
                dayTimeSlots[timeSlot] = parallelSessions[dayTimeKey];
            }
        });
        
        // Sort time slots by talk count
        const sortedTimeSlots = Object.entries(dayTimeSlots)
            .sort(([, a], [, b]) => b - a);
        
        const formattedDate = this.formatDate(date);
        const totalTalks = Object.values(dayTimeSlots).reduce((sum, count) => sum + count, 0);
        
        this.renderDayDetailsModal(formattedDate, sortedTimeSlots, totalTalks);
        document.getElementById('dayDetailsModal').style.display = 'block';
    }

    renderDayDetailsModal(formattedDate, timeSlots, totalTalks) {
        document.getElementById('dayModalTitle').textContent = `${formattedDate} - Time Slots`;
        
        const modalBody = document.getElementById('dayModalBody');
        modalBody.className = 'modal-body modal-scrollbar';
        modalBody.innerHTML = `
            <div class="day-details">
                <div class="day-summary">
                    <div class="summary-card">
                        <h4><i class="fas fa-calendar-day"></i> Day Summary</h4>
                        <div class="summary-stats">
                            <div class="stat-item">
                                <div class="stat-label">Total Time Slots</div>
                                <div class="stat-value">${timeSlots.length}</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">Total Talks</div>
                                <div class="stat-value">${totalTalks}</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-label">Avg Talks per Slot</div>
                                <div class="stat-value">${timeSlots.length > 0 ? (totalTalks / timeSlots.length).toFixed(1) : 0}</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="timeslots-breakdown">
                    <h4><i class="fas fa-clock"></i> Time Slots Breakdown</h4>
                    <div class="timeslots-grid">
                        ${timeSlots.map(([timeSlot, talkCount]) => `
                            <div class="timeslot-card">
                                <div class="timeslot-header">
                                    <div class="timeslot-time">
                                        <i class="fas fa-clock"></i>
                                        ${timeSlot}
                                    </div>
                                    <div class="timeslot-count">
                                        ${talkCount} talk${talkCount !== 1 ? 's' : ''}
                                    </div>
                                </div>
                                <div class="timeslot-bar">
                                    <div class="timeslot-fill" style="width: ${(talkCount / Math.max(...timeSlots.map(([, count]) => count))) * 100}%"></div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    closeDayDetailsModal() {
        document.getElementById('dayDetailsModal').style.display = 'none';
    }

    changePage(page) {
        this.currentPage = page;
        const searchInput = document.getElementById('searchInput');
        const typeFilter = document.getElementById('typeFilter');
        
        this.loadTalks({
            search: searchInput.value,
            type: typeFilter.value
        });
    }

    closeTalkModal() {
        document.getElementById('talkModal').style.display = 'none';
    }

    async exportData() {
        try {
            const response = await fetch('/api/export/json');
            const data = await response.json();
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ibm-event-analytics.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed. Please try again.');
        }
    }

    async refreshData() {
        this.showLoading();
        try {
            await this.loadAnalytics();
            this.renderDashboard();
            this.hideLoading();
        } catch (error) {
            console.error('Refresh failed:', error);
            this.showError('Failed to refresh data');
        }
    }

    // Utility methods
    generateColors(count) {
        const colors = [
            '#0f62fe', '#4589ff', '#24a148', '#f1c21b', '#da1e28',
            '#8a3ffc', '#fa4d56', '#6fdc8c', '#4ac1ff', '#d12771'
        ];
        
        const result = [];
        for (let i = 0; i < count; i++) {
            result.push(colors[i % colors.length]);
        }
        return result;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }

    cleanText(text) {
        if (!text) return '';
        return text.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
    }

    showLoading() {
        document.getElementById('loading').style.display = 'flex';
        document.getElementById('main-content').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
    }

    showError(message) {
        document.getElementById('loading').innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-exclamation-triangle" style="color: #da1e28;"></i>
                <p style="color: #da1e28;">${message}</p>
                <button class="btn btn-primary" onclick="dashboard.refreshData()">
                    Try Again
                </button>
            </div>
        `;
    }
}

// Global functions
function exportData() {
    dashboard.exportData();
}

function refreshData() {
    dashboard.refreshData();
}

function closeTalkModal() {
    dashboard.closeTalkModal();
}

function closeDayDetailsModal() {
    dashboard.closeDayDetailsModal();
}

// Initialize dashboard when page loads
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new EventAnalyticsDashboard();
});
