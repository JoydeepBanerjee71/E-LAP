document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('loanForm');
    const resultContainer = document.getElementById('resultContainer');
    
    // Format currency inputs
    const currencyInputs = ['Annual_Income', 'Loan_Amount', 'Assets'];
    currencyInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', function(e) {
                let value = e.target.value.replace(/,/g, '');
                if (value) {
                    value = parseFloat(value).toLocaleString('en-IN');
                }
                e.target.value = value;
            });
        }
    });

    // Handle dual inputs (range + number)
    const dualInputs = [
        { slider: 'Loan_Dur_slider', number: 'Loan_Dur', min: 1, max: 20 },
        { slider: 'Cibil_slider', number: 'Cibil', min: 300, max: 900 }
    ];

    dualInputs.forEach(({ slider, number, min, max }) => {
        const sliderInput = document.getElementById(slider);
        const numberInput = document.getElementById(number);

        if (sliderInput && numberInput) {
            // Update number input when slider moves
            sliderInput.addEventListener('input', function() {
                numberInput.value = this.value;
            });

            // Update slider when number input changes
            numberInput.addEventListener('input', function() {
                let value = parseInt(this.value);
                if (value < min) value = min;
                if (value > max) value = max;
                this.value = value;
                sliderInput.value = value;
            });

            // Validate on blur
            numberInput.addEventListener('blur', function() {
                if (!this.value) {
                    this.value = '';
                    sliderInput.value = min;
                }
            });
        }
    });

    // Form submission
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Show loading state
            const predictBtn = form.querySelector('button[type="submit"]');
            const originalContent = predictBtn.innerHTML;
            predictBtn.disabled = true;
            predictBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Predicting...';
            
            try {
                // Get form data and convert to object
                const formData = new FormData(form);
                const data = {};
                
                // Convert form data to object and handle numeric values
                formData.forEach((value, key) => {
                    // Remove commas from numeric values
                    if (key === 'Annual_Income' || key === 'Loan_Amount' || key === 'Assets') {
                        data[key] = parseFloat(value.replace(/,/g, ''));
                    } else if (key === 'Loan_Dur' || key === 'Cibil') {
                        data[key] = parseInt(value);
                    } else if (key === 'no_of_dep') {
                        // Handle the number of dependents dropdown
                        data[key] = parseInt(value.split(' ')[0]);
                    } else {
                        data[key] = value;
                    }
                });

                console.log('Sending data to ML service:', data); // Debug log

                // Flask backend runs on port 5001
                const response = await fetch('http://127.0.0.1:5001/predict', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Network response was not ok');
                }
                
                const result = await response.json();
                console.log('Received result:', result); // Debug log
                
                // Show result
                resultContainer.style.display = 'block';
                
                if (result.prediction === true) {
                    resultContainer.className = 'result-container approved';
                    resultContainer.innerHTML = `
                        <i class="fas fa-check-circle"></i>
                        <p>Congratulations! Your loan application has been pre-approved by our ML models.</p>
                        <p style="font-size: 0.9rem; margin-top: 5px; opacity: 0.9;">Please review the matched lender offers below to proceed with your application.</p>
                    `;
                    // Fetch and display matched lenders
                    matchLenders(data);
                } else {
                    // Hide lender matching section on rejection
                    document.getElementById('lenderMatchingSection').style.display = 'none';
                    resultContainer.className = 'result-container rejected';
                    resultContainer.innerHTML = `
                        <i class="fas fa-times-circle"></i>
                        <p>We regret to inform you that your loan application has been rejected.</p>
                        <div class="tips-container">
                            <h3>Tips to improve your application:</h3>
                            <ul>
                                <li>Improve your CIBIL score</li>
                                <li>Increase your annual income</li>
                                <li>Reduce your existing loan burden</li>
                                <li>Maintain a stable employment history</li>
                            </ul>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Prediction Error:', error);
                alert('An error occurred: ' + error.message);
            } finally {
                predictBtn.disabled = false;
                predictBtn.innerHTML = originalContent;
            }
        });
    }

    // --- Lender Matching & Application Submission Logic ---
    async function matchLenders(data) {
        const token = localStorage.getItem('token');
        const lenderMatchingSection = document.getElementById('lenderMatchingSection');
        const lendersList = document.getElementById('lendersList');
        
        if (!token) {
            lendersList.innerHTML = `
                <div style="text-align: center; padding: 25px; border: 1px dashed #f59e0b; border-radius: 8px; background: #fffbeb; color: #b45309;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2.2rem; margin-bottom: 10px;"></i>
                    <p style="font-weight: 600;">Account Authentication Required</p>
                    <p style="font-size: 0.9rem; margin-top: 5px;">You must be logged in as a borrower to view and apply for lender offers.</p>
                    <a href="/login/login.html" class="doc-verify-btn" style="display: inline-block; margin-top: 12px; text-decoration: none; background: #d97706; padding: 8px 20px; font-size: 0.9rem;">
                        <i class="fas fa-sign-in-alt"></i> Login Now
                    </a>
                </div>
            `;
            lenderMatchingSection.style.display = 'block';
            lenderMatchingSection.scrollIntoView({ behavior: 'smooth' });
            return;
        }
        
        lendersList.innerHTML = `
            <div style="text-align: center; padding: 30px; color: #64748b;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2.5rem; margin-bottom: 12px; color: #3b82f6;"></i>
                <p style="font-weight: 500;">Searching for lending partners matching your credit profile...</p>
            </div>
        `;
        lenderMatchingSection.style.display = 'block';
        lenderMatchingSection.scrollIntoView({ behavior: 'smooth' });
        
        try {
            const queryParams = new URLSearchParams({
                cibil: data.Cibil,
                amount: data.Loan_Amount,
                loan_type: data.loan_type
            });
            
            const response = await fetch(`/api/loan/match-lenders?${queryParams.toString()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to find matching lenders');
            }
            
            const lenders = await response.json();
            console.log('Matched lenders response:', lenders);
            
            if (lenders.length === 0) {
                lendersList.innerHTML = `
                    <div style="text-align: center; padding: 30px; border: 2px dashed #e2e8f0; border-radius: 10px; background: #f8fafc; color: #64748b;">
                        <i class="fas fa-info-circle" style="font-size: 2.2rem; margin-bottom: 12px; color: #3b82f6;"></i>
                        <p style="font-weight: 600; color: #334155;">No Exact Lender Matches Found</p>
                        <p style="font-size: 0.9rem; margin-top: 5px; max-width: 500px; margin-left: auto; margin-right: auto;">
                            We couldn't find registered lenders matching your CIBIL threshold, loan type (${data.loan_type}), or amount requirements at this moment.
                        </p>
                        <button onclick="window.location.href='/kyc/kyc.html'" class="doc-verify-btn" style="margin-top: 15px;">
                            <i class="fas fa-file-alt"></i> Proceed to Document Verification
                        </button>
                    </div>
                `;
                return;
            }
            
            lendersList.innerHTML = '';
            lenders.forEach(lender => {
                const card = document.createElement('div');
                card.className = 'lender-card';
                card.innerHTML = `
                    <div class="lender-info">
                        <div class="lender-name">${lender.company_name}</div>
                        <div class="lender-details-row">
                            <span><i class="fas fa-shield-alt"></i> Min CIBIL: <strong>${lender.min_cibil}</strong></span>
                            <span><i class="fas fa-wallet"></i> Max Support: <strong>₹${parseFloat(lender.max_loan_amount).toLocaleString('en-IN')}</strong></span>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap;">
                        <div class="lender-rate">
                            ${lender.interest_rate_offered}% <span>p.a.</span>
                        </div>
                        <button class="lender-apply-btn" data-lender-id="${lender.user_id}">
                            Apply Offer
                        </button>
                    </div>
                `;
                
                const applyBtn = card.querySelector('.lender-apply-btn');
                applyBtn.addEventListener('click', () => applyToLender(lender, data, applyBtn));
                lendersList.appendChild(card);
            });
            
        } catch (error) {
            console.error('Error matching lenders:', error);
            lendersList.innerHTML = `
                <div style="text-align: center; padding: 25px; border: 1px solid #fee2e2; border-radius: 8px; background: #fef2f2; color: #b91c1c;">
                    <i class="fas fa-exclamation-circle" style="font-size: 2.2rem; margin-bottom: 10px;"></i>
                    <p style="font-weight:600;">Failed to Match Lenders</p>
                    <p style="font-size:0.85rem; margin-top:5px;">${error.message}</p>
                </div>
            `;
        }
    }

    async function applyToLender(lender, data, button) {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const originalContent = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying...';
        
        try {
            const payload = {
                lender_id: lender.user_id,
                loan_type: data.loan_type,
                amount: data.Loan_Amount,
                tenure_months: data.Loan_Dur * 12,
                interest_rate: lender.interest_rate_offered
            };
            
            const response = await fetch('/api/loan/apply', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errRes = await response.json();
                throw new Error(errRes.error || 'Failed to submit loan application');
            }
            
            const result = await response.json();
            console.log('Application submission response:', result);
            
            button.innerHTML = '<i class="fas fa-check"></i> Applied';
            button.style.background = '#10b981';
            button.style.borderColor = '#10b981';
            
            // Disable all other apply buttons
            document.querySelectorAll('.lender-apply-btn').forEach(btn => {
                if (btn !== button) btn.disabled = true;
            });
            
            showSuccessNotification(`Your application has been submitted to ${lender.company_name}! Redirecting to KYC...`);
            
            setTimeout(() => {
                window.location.href = '/kyc/kyc.html';
            }, 2500);
            
        } catch (error) {
            console.error('Lender application error:', error);
            button.disabled = false;
            button.innerHTML = originalContent;
            alert('Application failed: ' + error.message);
        }
    }

    function showSuccessNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 25px;
            right: 25px;
            padding: 16px 24px;
            background: #ffffff;
            color: #1e293b;
            font-family: 'Poppins', sans-serif;
            font-size: 0.95rem;
            font-weight: 500;
            border-left: 5px solid #10b981;
            border-radius: 6px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 99999;
            transform: translateX(130%);
            transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        `;
        notification.innerHTML = `
            <i class="fas fa-check-circle" style="color: #10b981; font-size: 1.3rem;"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(notification);
        
        // Trigger slide in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 50);
        
        // Auto remove
        setTimeout(() => {
            notification.style.transform = 'translateX(130%)';
            setTimeout(() => {
                notification.remove();
            }, 400);
        }, 3500);
    }
});
