document.addEventListener('DOMContentLoaded', function() {
    // Password visibility toggle
    const togglePassword = document.querySelector('.toggle-password');
    const passwordInput = document.querySelector('#password');
    
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');
        });
    }

    // Role select visibility toggles
    const roleSelect = document.getElementById('role');
    const borrowerFields = document.getElementById('borrowerFields');
    const lenderFields = document.getElementById('lenderFields');

    if (roleSelect && borrowerFields && lenderFields) {
        roleSelect.addEventListener('change', function() {
            if (this.value === 'lender') {
                borrowerFields.style.display = 'none';
                lenderFields.style.display = 'block';

                document.getElementById('companyName').required = true;
                document.getElementById('minCibil').required = true;
                document.getElementById('maxLoanAmount').required = true;
                document.getElementById('interestRate').required = true;

                document.getElementById('account').required = false;
                document.getElementById('ifsc').required = false;
            } else {
                borrowerFields.style.display = 'block';
                lenderFields.style.display = 'none';

                document.getElementById('companyName').required = false;
                document.getElementById('minCibil').required = false;
                document.getElementById('maxLoanAmount').required = false;
                document.getElementById('interestRate').required = false;
            }
        });
    }

    // Password strength meter
    if (passwordInput) {
        const styleDiv = document.createElement('div');
        styleDiv.className = 'strength-text';
        styleDiv.style.cssText = 'font-size:0.8rem; margin-top:5px; color:var(--text-light); transition:color 0.3s;';
        styleDiv.textContent = 'Password Strength';
        passwordInput.parentNode.parentNode.appendChild(styleDiv);

        passwordInput.addEventListener('input', function() {
            const strength = checkPasswordStrength(this.value);
            const colors = ['#F44336', '#FF9800', '#FDD835', '#4CAF50'];
            const texts = ['Weak', 'Fair', 'Good', 'Strong'];
            
            if (this.value) {
                styleDiv.textContent = 'Strength: ' + texts[strength - 1];
                styleDiv.style.color = colors[strength - 1];
            } else {
                styleDiv.textContent = 'Password Strength';
                styleDiv.style.color = 'var(--text-light)';
            }
        });
    }

    function checkPasswordStrength(password) {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (password.match(/[A-Z]/)) strength++;
        if (password.match(/[0-9]/)) strength++;
        if (password.match(/[^A-Za-z0-9]/)) strength++;
        return Math.max(1, strength);
    }

    // Form validation and submit
    const registerForm = document.getElementById('registerForm');
    const phoneInput = document.getElementById('phone');

    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            // Validate phone number
            if (phoneInput && !phoneInput.value.match(/^[0-9]{10}$/)) {
                showError(phoneInput, 'Please enter a valid 10-digit phone number');
                return;
            }

            // Show loading state
            const submitBtn = this.querySelector('.register-btn');
            const originalContent = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
            submitBtn.disabled = true;

            try {
                // Collect general data
                const payload = {
                    fullName: document.getElementById('fullName').value,
                    username: document.getElementById('username').value,
                    email: document.getElementById('email').value,
                    phone: phoneInput.value,
                    role: roleSelect.value,
                    password: passwordInput.value
                };

                // Set field keys to match routes/auth.routes.js payload
                const fetchBody = {
                    username: payload.username,
                    email: payload.email,
                    password: payload.password,
                    full_name: payload.fullName,
                    phone_number: payload.phone,
                    role: payload.role
                };

                // Collect role specific data
                if (payload.role === 'lender') {
                    fetchBody.company_name = document.getElementById('companyName').value;
                    fetchBody.min_cibil = parseInt(document.getElementById('minCibil').value);
                    fetchBody.max_loan_amount = parseFloat(document.getElementById('maxLoanAmount').value);
                    fetchBody.interest_rate_offered = parseFloat(document.getElementById('interestRate').value);

                    // Collect multiple selected loan types
                    const selectTypes = document.getElementById('loanTypes');
                    const supportedTypes = Array.from(selectTypes.selectedOptions).map(opt => opt.value);
                    fetchBody.supported_loan_types = supportedTypes.join(',');
                } else {
                    const borrowerAccount = document.getElementById('account').value;
                    const borrowerIfsc = document.getElementById('ifsc').value;
                    const borrowerBranch = document.getElementById('branch').value;
                    
                    fetchBody.address = JSON.stringify({
                        account: borrowerAccount,
                        ifsc: borrowerIfsc,
                        branch: borrowerBranch
                    });
                }

                console.log('Registering user payload:', fetchBody);

                // Call Node Express Register API
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(fetchBody)
                });

                if (!response.ok) {
                    const errorResponse = await response.json();
                    throw new Error(errorResponse.error || 'Registration failed');
                }

                const result = await response.json();
                console.log('Registration Success result:', result);

                showSuccess('Account created successfully! Redirecting...');
                
                // Reset form
                registerForm.reset();
                
                // Redirect to Login page after successful registration
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);

            } catch (error) {
                console.error('Registration Fetch Error:', error);
                alert('Registration failed: ' + error.message);
            } finally {
                submitBtn.innerHTML = originalContent;
                submitBtn.disabled = false;
            }
        });
    }

    function showError(input, message) {
        const formGroup = input.closest('.form-group');
        const helper = formGroup.querySelector('.helper-text');
        if (helper) {
            helper.textContent = message;
            helper.style.color = '#F44336';
        }
        input.style.borderColor = '#F44336';

        setTimeout(() => {
            if (helper) {
                helper.textContent = helper.dataset.original || 'Enter valid details';
                helper.style.color = 'var(--text-light)';
            }
            input.style.borderColor = 'var(--light-gray)';
        }, 3000);
    }

    function showSuccess(message) {
        const notification = document.createElement('div');
        notification.className = 'success-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: white;
            border-left: 4px solid #4CAF50;
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            transform: translateX(120%);
            transition: all 0.3s ease;
            z-index: 1000;
        `;
        notification.innerHTML = `
            <i class="fas fa-check-circle" style="color:#4CAF50;"></i>
            <span style="color:#333; font-weight:500;">${message}</span>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);

        setTimeout(() => {
            notification.style.transform = 'translateX(120%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
});
