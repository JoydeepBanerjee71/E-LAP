document.addEventListener('DOMContentLoaded', function() {
    // 1. Session Setup and Auth Check
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const username = localStorage.getItem('username') || 'Lender Partner';

    if (!token || role !== 'lender') {
        window.location.href = '/login/login.html';
        return;
    }

    // Set greeting names
    document.getElementById('lenderNameDisplay').textContent = username;
    document.getElementById('welcomeHeader').textContent = `Welcome Back, ${username}!`;

    let applications = [];

    // Elements
    const tableBody = document.getElementById('applicationsTableBody');
    const searchInput = document.getElementById('tableSearch');
    const logoutBtn = document.getElementById('logoutButton');

    // Stats Elements
    const statTotal = document.getElementById('statTotal');
    const statPending = document.getElementById('statPending');
    const statApproved = document.getElementById('statApproved');
    const statPortfolio = document.getElementById('statPortfolio');

    // 2. Fetch and Load Applications
    async function fetchApplications() {
        try {
            const response = await fetch('/api/loan/lender-applications', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    // Token expired or invalid role
                    handleLogout();
                    return;
                }
                throw new Error('Failed to fetch applications');
            }

            applications = await response.json();
            console.log('Fetched Applications:', applications);

            updateStats();
            renderTable(applications);

        } catch (error) {
            console.error('Error loading applications:', error);
            showToast('Error loading application list: ' + error.message, 'error');
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: #ef4444; padding: 30px;">
                        <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 8px;"></i>
                        <p>Error listing applications from server.</p>
                    </td>
                </tr>
            `;
        }
    }

    // 3. Update Summary Stat Counters
    function updateStats() {
        const total = applications.length;
        const pending = applications.filter(a => a.status === 'pending').length;
        const approved = applications.filter(a => a.status === 'approved').length;
        
        // Portfolio Value is the sum of approved loan amounts
        const portfolioSum = applications
            .filter(a => a.status === 'approved')
            .reduce((sum, current) => sum + parseFloat(current.amount), 0);

        statTotal.textContent = total;
        statPending.textContent = pending;
        statApproved.textContent = approved;
        statPortfolio.textContent = `₹${portfolioSum.toLocaleString('en-IN')}`;
    }

    // 4. Render Table Records
    function renderTable(dataList) {
        if (dataList.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7">
                        <div class="empty-state">
                            <i class="fas fa-inbox"></i>
                            <p>No borrower loan applications match your current workspace criteria.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = '';
        dataList.forEach(app => {
            const tr = document.createElement('tr');
            
            // Format dates
            const dateObj = new Date(app.created_at);
            const formattedDate = dateObj.toLocaleDateString('en-IN', {
                year: 'numeric', month: 'short', day: 'numeric'
            });

            // CIBIL Score Badge styling
            const cibil = app.cibil_score || 'N/A';
            let cibilClass = 'cibil-poor';
            if (cibil !== 'N/A') {
                if (cibil >= 750) cibilClass = 'cibil-excellent';
                else if (cibil >= 700) cibilClass = 'cibil-good';
                else if (cibil >= 600) cibilClass = 'cibil-average';
            }

            // Action buttons disabled if not pending
            const isPending = app.status === 'pending';
            const actionButtons = isPending ? `
                <div class="action-btns">
                    <button class="action-btn approve" data-id="${app.id}">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="action-btn reject" data-id="${app.id}">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>
            ` : `
                <span style="font-size: 0.85rem; color: var(--text-light); font-weight: 500;">
                    Decision Logged
                </span>
            `;

            tr.innerHTML = `
                <td>
                    <strong style="color: var(--dark-blue);">#L-${app.id}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 3px;">
                        ${formattedDate}
                    </div>
                </td>
                <td>
                    <div class="borrower-info-col">
                        <span class="borrower-name-label">${app.borrower_name}</span>
                        <span class="borrower-meta-label"><i class="far fa-envelope"></i> ${app.borrower_email}</span>
                        <span class="borrower-meta-label"><i class="fas fa-phone-alt"></i> ${app.borrower_phone || 'N/A'}</span>
                    </div>
                </td>
                <td>
                    <span class="cibil-badge ${cibilClass}">${cibil}</span>
                </td>
                <td>
                    <strong style="color: var(--dark-blue);">₹${parseFloat(app.amount).toLocaleString('en-IN')}</strong>
                    <div style="font-size: 0.8rem; color: var(--primary); font-weight: 600;">
                        ${app.loan_type} Loan
                    </div>
                </td>
                <td>
                    <strong>${app.tenure_months} Months</strong>
                    <div style="font-size: 0.8rem; color: var(--success); font-weight: 500;">
                        @ ${app.interest_rate}% p.a.
                    </div>
                </td>
                <td>
                    <span class="badge ${app.status}">${app.status}</span>
                </td>
                <td>
                    ${actionButtons}
                </td>
            `;

            // Action listeners
            if (isPending) {
                tr.querySelector('.action-btn.approve').addEventListener('click', () => handleDecision(app.id, 'approved'));
                tr.querySelector('.action-btn.reject').addEventListener('click', () => handleDecision(app.id, 'rejected'));
            }

            tableBody.appendChild(tr);
        });
    }

    // 5. Update Status Callbacks (Approve / Reject)
    async function handleDecision(loanId, status) {
        // Disable buttons on screen during transaction
        const row = document.querySelector(`button[data-id="${loanId}"]`).closest('tr');
        row.querySelectorAll('.action-btn').forEach(btn => btn.disabled = true);

        try {
            const response = await fetch('/api/loan/update-status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    loan_id: loanId,
                    status: status
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to update loan status');
            }

            const result = await response.json();
            showToast(`Loan application #${loanId} successfully ${status}!`, 'success');
            
            // Reload database state
            await fetchApplications();

        } catch (error) {
            console.error('Decision logging error:', error);
            showToast('Decision error: ' + error.message, 'error');
            row.querySelectorAll('.action-btn').forEach(btn => btn.disabled = false);
        }
    }

    // 6. Dynamic table search filter
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.toLowerCase().trim();
            if (!query) {
                renderTable(applications);
                return;
            }

            const filtered = applications.filter(app => {
                const name = (app.borrower_name || '').toLowerCase();
                const type = (app.loan_type || '').toLowerCase();
                const status = (app.status || '').toLowerCase();
                const amount = parseFloat(app.amount).toString();
                const id = app.id.toString();

                return name.includes(query) ||
                       type.includes(query) ||
                       status.includes(query) ||
                       amount.includes(query) ||
                       id.includes(query);
            });

            renderTable(filtered);
        });
    }

    // 7. Toast Notifications
    function showToast(message, type) {
        const toast = document.getElementById('toastNotification');
        const icon = document.getElementById('toastIcon');
        const text = document.getElementById('toastMessage');

        text.textContent = message;
        
        if (type === 'success') {
            toast.style.borderLeftColor = 'var(--success)';
            icon.className = 'fas fa-check-circle';
            icon.style.color = 'var(--success)';
        } else {
            toast.style.borderLeftColor = 'var(--danger)';
            icon.className = 'fas fa-exclamation-circle';
            icon.style.color = 'var(--danger)';
        }

        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3500);
    }

    // 8. Logout operations
    function handleLogout() {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('username');
        window.location.href = '/login/login.html';
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            handleLogout();
        });
    }

    // Load table initial view
    fetchApplications();
});
