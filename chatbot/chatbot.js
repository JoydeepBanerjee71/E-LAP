document.addEventListener('DOMContentLoaded', function() {
    // Initialize chat features
    const chatBody = document.querySelector('.chat-body');
    const featureCards = document.querySelectorAll('.feature-card');
    const tags = document.querySelectorAll('.tag');
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const suggestionChips = document.querySelectorAll('.chip');

    // Animate feature cards on hover
    featureCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
            this.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.1)';
        });

        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.05)';
        });
    });

    // Simple offline responses database
    const botResponses = {
        'loan requirements': 'To apply for an E-LAP loan, you typically need:\n• Valid identity proof (Aadhaar, PAN)\n• Income proof (recent salary slips/ITR)\n• Bank statements (last 6 months)\n• Credit (CIBIL) score above 650\n• Age between 21-65 years',
        'interest rates': 'Our current E-LAP portal interest rates are:\n• Personal Loan: 10.99% - 24.99% p.a.\n• Home Loan: 6.99% - 9.99% p.a.\n• Business Loan: 15.99% - 29.99% p.a.',
        'application process': 'The process is fully automated:\n1. Fill out the online Loan Approval form\n2. The ML algorithm assesses your eligibility\n3. Upon approval, proceed to digital KYC upload\n4. System verifies documents in 24 hours\n5. Final loan agreement is generated for signature',
        'emi calculator': 'You can calculate your monthly payments dynamically. What is your expected loan amount and term (years)? Let me know, and I can estimate it for you!',
        'hi': 'Hello! 👋 I am your E-LAP virtual assistant. How can I help you with your loan queries today?',
        'hello': 'Hello! 👋 I am your E-LAP virtual assistant. How can I help you with your loan queries today?',
        'how are you': 'I am running great! Ready to assist you with loan predictions and details.',
        'what is your name': 'I am the E-LAP Assistant, your helper for loan eligibility and portal guidelines.',
        'what is your purpose': 'My goal is to help guide you through the loan application, ML predictor, and document verification process.',
        'default': "I'm not sure about that particular request. Could you please rephrase it, or select one of the suggestion chips below?"
    };

    function getBotResponse(userMessage) {
        const message = userMessage.toLowerCase();
        for (const key in botResponses) {
            if (message.includes(key)) {
                return botResponses[key];
            }
        }
        return botResponses.default;
    }

    function addMessage(message, isUser = false) {
        // Automatically hide the welcome screen and show messages container when chat starts
        const welcomeScreen = document.querySelector('.bot-welcome');
        if (welcomeScreen && welcomeScreen.style.display !== 'none') {
            welcomeScreen.style.display = 'none';
            chatMessages.style.display = 'flex';
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
        
        // Add bot icon for bot messages
        if (!isUser) {
            const botIcon = document.createElement('div');
            botIcon.className = 'bot-icon message-icon';
            const iconI = document.createElement('i');
            iconI.className = 'fas fa-robot';
            botIcon.appendChild(iconI);
            messageDiv.appendChild(botIcon);
        }
        
        const messageWrapper = document.createElement('div');
        messageWrapper.className = 'message-wrapper';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = message;
        
        const messageTime = document.createElement('span');
        messageTime.className = 'message-time';
        messageTime.textContent = 'Just now';
        
        messageWrapper.appendChild(messageContent);
        messageWrapper.appendChild(messageTime);
        messageDiv.appendChild(messageWrapper);
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function showTypingIndicator(show = true) {
        const indicator = document.querySelector('.typing-indicator');
        if (indicator) {
            indicator.style.display = show ? 'flex' : 'none';
            // Scroll to bottom when showing typing indicator
            if (show) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        }
    }

    function handleUserInput() {
        const message = userInput.value.trim();
        if (message) {
            addMessage(message, true);
            userInput.value = '';
            showTypingIndicator(true);
            
            // Rasa server REST endpoint is 5005/webhooks/rest/webhook
            fetch('http://localhost:5005/webhooks/rest/webhook', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sender: 'user', message: message })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Server returned error status');
                }
                return response.json();
            })
            .then(data => {
                showTypingIndicator(false);
                if (data && data.length > 0 && data[0].text) {
                    addMessage(data[0].text);
                } else {
                    const fallbackResponse = getBotResponse(message);
                    addMessage(fallbackResponse);
                }
            })
            .catch(error => {
                console.warn('Rasa server offline or error. Using offline fallback response.', error);
                // Simulate bot delay for realism
                setTimeout(() => {
                    showTypingIndicator(false);
                    const fallbackResponse = getBotResponse(message);
                    addMessage(fallbackResponse);
                }, 1000);
            });
        }
    }

    // Event listeners
    if (sendButton) {
        sendButton.addEventListener('click', handleUserInput);
    }
    
    if (userInput) {
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleUserInput();
            }
        });
    }

    // Handle suggestion chips
    suggestionChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const chipText = chip.textContent;
            addMessage(chipText, true);
            showTypingIndicator(true);
            
            // Fetch with offline fallback for chips as well
            fetch('http://localhost:5005/webhooks/rest/webhook', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sender: 'user', message: chipText })
            })
            .then(response => response.json())
            .then(data => {
                showTypingIndicator(false);
                if (data && data.length > 0 && data[0].text) {
                    addMessage(data[0].text);
                } else {
                    const botResponse = getBotResponse(chipText.toLowerCase());
                    addMessage(botResponse);
                }
            })
            .catch(error => {
                setTimeout(() => {
                    showTypingIndicator(false);
                    const botResponse = getBotResponse(chipText.toLowerCase());
                    addMessage(botResponse);
                }, 1000);
            });
        });
    });

    // Handle feature card click queries
    featureCards.forEach(card => {
        card.addEventListener('click', function() {
            const query = this.getAttribute('data-query');
            if (query) {
                userInput.value = query;
                handleUserInput();
            }
        });
    });

    // Handle tag click queries
    tags.forEach(tag => {
        tag.addEventListener('click', function() {
            const query = this.getAttribute('data-query');
            if (query) {
                userInput.value = query;
                handleUserInput();
            }
        });
    });

    // Add message styles dynamically
    const style = document.createElement('style');
    style.textContent = `
        .message {
            margin: 15px 0;
            opacity: 0;
            transform: translateY(20px);
            animation: messageAppear 0.3s forwards;
            display: flex;
            gap: 12px;
        }

        .message-content {
            max-width: 85%;
            padding: 12px 20px;
            border-radius: 15px;
            position: relative;
            white-space: pre-line;
        }

        .user-message {
            justify-content: flex-end;
        }

        .user-message .message-content {
            background: var(--gradient-1);
            color: white;
            border-bottom-right-radius: 5px;
        }

        .bot-message .message-content {
            background: white;
            color: var(--text-dark);
            border-bottom-left-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }

        .message-time {
            font-size: 0.7rem;
            opacity: 0.7;
            margin-top: 5px;
            display: block;
        }

        @keyframes messageAppear {
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);

    // Mobile menu toggle
    const menuBtn = document.createElement('button');
    menuBtn.className = 'mobile-menu-btn';
    menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
    const chatHeader = document.querySelector('.chat-header');
    if (chatHeader) {
        chatHeader.prepend(menuBtn);
    }

    menuBtn.addEventListener('click', () => {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('active');
        }
    });

    // Add mobile menu button styles
    const mobileStyle = document.createElement('style');
    mobileStyle.textContent = `
        .mobile-menu-btn {
            display: none;
            background: none;
            border: none;
            font-size: 1.2rem;
            color: white;
            cursor: pointer;
            margin-right: 15px;
        }

        @media (max-width: 992px) {
            .mobile-menu-btn {
                display: block;
            }
        }
    `;
    document.head.appendChild(mobileStyle);
});