// Global JavaScript functionality for Setu website
document.addEventListener('DOMContentLoaded', function() {
    initViewportDetection();
    initResponsiveElements();
    initInteractiveFeatures();
    initFormHandling();
    setActiveNavigation();
    // initTranscription(); // Moved to separate transcribe.js file
    initContactForm();   // NEW: Initialize contact form submission
    fetchAboutData();    // Existing: Fetch about data
});

// ---------------- VIEWPORT + RESPONSIVE ----------------
function initViewportDetection() {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    console.log('Current viewport:', viewport);

    window.addEventListener('resize', function() {
        viewport.width = window.innerWidth;
        viewport.height = window.innerHeight;
        console.log('Viewport resized to:', viewport);
        adjustElementsForViewport(viewport);
    });

    adjustElementsForViewport(viewport);
}

function adjustElementsForViewport(viewport) {
    const isMobile = viewport.width <= 768;
    const isTablet = viewport.width > 768 && viewport.width <= 1024;
    const isDesktop = viewport.width > 1024;

    adjustHeroElements(viewport);
    adjustFeatureCards(viewport);
    adjustTeamCards(viewport);
    adjustContentPanels(viewport);
    adjustFormElements(viewport);
}

function adjustHeroElements(viewport) {
    const heroIcon = document.querySelector('.hero-icon');
    const heroText = document.querySelector('.hero-text');
    const heroGraphic = document.querySelector('.hero-graphic');

    if (heroIcon && heroText && heroGraphic) {
        if (viewport.width <= 480) {
            heroIcon.style.width = '50px';
            heroIcon.style.height = '50px';
            heroIcon.style.fontSize = '1.5rem';
            heroText.style.fontSize = '2rem';
            heroGraphic.style.flexDirection = 'column';
        } else if (viewport.width <= 768) {
            heroIcon.style.width = '60px';
            heroIcon.style.height = '60px';
            heroIcon.style.fontSize = '2rem';
            heroText.style.fontSize = '2.5rem';
            heroGraphic.style.flexDirection = 'row';
        } else {
            heroIcon.style.width = '80px';
            heroIcon.style.height = '80px';
            heroIcon.style.fontSize = '2.5rem';
            heroText.style.fontSize = '3rem';
            heroGraphic.style.flexDirection = 'row';
        }
    }
}

function adjustFeatureCards(viewport) {
    const featuresGrid = document.querySelector('.features-grid');
    if (featuresGrid) {
        if (viewport.width <= 768) {
            featuresGrid.style.gridTemplateColumns = '1fr';
            featuresGrid.style.gap = '1.5rem';
        } else {
            featuresGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(300px, 1fr))';
            featuresGrid.style.gap = '2rem';
        }
    }
}

function adjustTeamCards(viewport) {
    const teamGrid = document.querySelector('.team-grid');
    if (teamGrid) {
        if (viewport.width <= 768) {
            teamGrid.style.gridTemplateColumns = '1fr';
            teamGrid.style.gap = '1.5rem';
        } else if (viewport.width <= 1024) {
            teamGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
            teamGrid.style.gap = '2rem';
        } else {
            teamGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
            teamGrid.style.gap = '2rem';
        }
    }
}

function adjustContentPanels(viewport) {
    const contentWrapper = document.querySelector('.content-wrapper');
    const leftColumn = document.querySelector('.left-column .content-panel');
    const rightColumnPanels = document.querySelectorAll('.right-column .content-panel');

    if (contentWrapper && leftColumn && rightColumnPanels.length > 0) {
        if (viewport.width <= 1024) {
            contentWrapper.style.gridTemplateColumns = '1fr';
            contentWrapper.style.gap = '1.5rem';
            leftColumn.style.minHeight = '400px';
            rightColumnPanels.forEach(panel => { panel.style.minHeight = '180px'; });
        } else {
            contentWrapper.style.gridTemplateColumns = '2fr 1fr';
            contentWrapper.style.gap = '2rem';
            leftColumn.style.minHeight = '500px';
            rightColumnPanels.forEach(panel => { panel.style.minHeight = '200px'; });
        }
    }
}

function adjustFormElements(viewport) {
    const contactContent = document.querySelector('.contact-content');
    const aboutContent = document.querySelector('.about-content');

    if (contactContent) {
        contactContent.style.gridTemplateColumns = viewport.width <= 1024 ? '1fr' : '1fr 1fr';
    }
    if (aboutContent) {
        aboutContent.style.gridTemplateColumns = viewport.width <= 1024 ? '1fr' : '1fr 1fr';
    }
}

// ---------------- INTERACTIVE FEATURES ----------------
function initResponsiveElements() {
    function updateResponsiveClasses() {
        const body = document.body;
        const width = window.innerWidth;
        body.classList.remove('mobile', 'tablet', 'desktop');
        if (width <= 768) body.classList.add('mobile');
        else if (width <= 1024) body.classList.add('tablet');
        else body.classList.add('desktop');
    }
    updateResponsiveClasses();
    window.addEventListener('resize', updateResponsiveClasses);
}

function initInteractiveFeatures() {
    const cards = document.querySelectorAll('.feature-card, .team-card, .faq-item');
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
            this.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.15)';
        });
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
        });
    });

    const buttons = document.querySelectorAll('.btn, .section-btn, .login-btn');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            this.appendChild(ripple);

            setTimeout(() => ripple.remove(), 600);
        });
    });
}

function initFormHandling() {
    const contactForm = document.querySelector('.contact-form form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const data = Object.fromEntries(formData);
            if (!data.name || !data.email || !data.subject || !data.message) {
                showNotification('Please fill in all fields', 'error');
                return;
            }
            showNotification('Thank you for your message! We\'ll get back to you soon.', 'success');
            this.reset();
        });
    }
}


// Transcription functionality moved to transcribe.js

// NEW: Handle contact form submission
function initContactForm() {
    const contactForm = document.querySelector('.contact-form form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(contactForm);
            const data = {
                name: formData.get('name'),
                email: formData.get('email'),
                subject: formData.get('subject'),
                message: formData.get('message')
            };
            // // Optional: Client-side validation
            // if (!data.email.includes('@')) {
            //     showNotification('Please enter a valid email address.', 'error');
            //     return;
            // }
            // if (data.message.length < 10) {
            //     showNotification('Message must be at least 10 characters long.', 'error');
            //     return;
            // } correct

            const submitBtn = contactForm.querySelector('button');
            submitBtn.disabled = true; // Disable button during submission
            submitBtn.textContent = 'Submitting...'; // Update button text

            try {
                const response = await fetch('http://localhost:8000/contact', { // Update URL if deployed
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (!response.ok) throw new Error('Submission failed');
                const result = await response.json();
                showNotification(result.message, 'success');
                contactForm.reset();
            } catch (error) {
                console.error('Contact error:', error);
                showNotification('Failed to send message. Try again.', 'error');
            }
            finally {
                submitBtn.disabled = false; // Re-enable button
                submitBtn.textContent = 'Submit'; // Restore button text
                }
        });
    }
}


// ---------------- UTILITIES ----------------
function setActiveNavigation() {
    const currentPage = window.location.pathname.split('/').pop() || 'home.html';
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px;
        padding: 1rem 1.5rem; border-radius: 5px; color: white;
        font-weight: 500; z-index: 1000; transform: translateX(100%);
        transition: transform 0.3s ease; max-width: 300px;
    `;
    switch (type) {
        case 'success': notification.style.background = '#48BB78'; break;
        case 'error': notification.style.background = '#F56565'; break;
        default: notification.style.background = '#2C5282';
    }
    document.body.appendChild(notification);
    setTimeout(() => { notification.style.transform = 'translateX(0)'; }, 100);
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Ripple CSS
const rippleCSS = `
    .ripple { position: absolute; border-radius: 50%; background: rgba(255, 255, 255, 0.6);
        transform: scale(0); animation: ripple-animation 0.6s linear; pointer-events: none; }
    @keyframes ripple-animation { to { transform: scale(4); opacity: 0; } }
`;
const style = document.createElement('style');
style.textContent = rippleCSS;
document.head.appendChild(style);

// Export
window.SetuWebsite = { adjustElementsForViewport, showNotification, initViewportDetection };







// // API:
// // script.js
// document.getElementById('fetchDataBtn').addEventListener('click', fetchData);

// function fetchData() {
//     const apiUrl = 'https://jsonplaceholder.typicode.com/posts/1'; // Example public API
//     // For xAI API, replace with something like 'https://x.ai/api/grok' (check documentation)

//     fetch(apiUrl)
//         .then(response => {
//             if (!response.ok) {
//                 throw new Error('Network response was not ok');
//             }
//             return response.json();
//         })
//         .then(data => {
//             // Update the DOM with the API response
//             const resultDiv = document.getElementById('result');
//             resultDiv.innerHTML = `<p><strong>Title:</strong> ${data.title}</p>
//                                   <p><strong>Body:</strong> ${data.body}</p>`;
//         })
//         .catch(error => {
//             console.error('Error fetching data:', error);
//             document.getElementById('result').innerHTML = '<p>Error loading data. Check console.</p>';
//         });
// }

// function fetchData() {
//     const apiUrl = 'https://x.ai/api/grok'; // Hypothetical endpoint
//     const apiKey = 'your-api-key-here'; // Replace with your actual API key

//     fetch(apiUrl, {
//         method: 'GET', // or 'POST', etc., based on API
//         headers: {
//             'Authorization': `Bearer ${apiKey}`,
//             'Content-Type': 'application/json'
//         }
//     })
//     .then(response => {
//         if (!response.ok) {
//             throw new Error('Network response was not ok');
//         }
//         return response.json();
//     })
//     .then(data => {
//         const resultDiv = document.getElementById('result');
//         resultDiv.innerHTML = `<p>${JSON.stringify(data)}</p>`; // Adjust based on API response
//     })
//     .catch(error => {
//         console.error('Error fetching data:', error);
//         document.getElementById('result').innerHTML = '<p>Error loading data. Check console.</p>';
//     });
// }


// function fetchData() {
//     const apiUrl = 'https://x.ai/api/grok'; // Hypothetical endpoint
//     const apiKey = 'your-api-key-here';
//     const requestBody = {
//         query: 'What is the time now?', // Example input
//         format: 'json'
//     };

//     fetch(apiUrl, {
//         method: 'POST',
//         headers: {
//             'Authorization': `Bearer ${apiKey}`,
//             'Content-Type': 'application/json'
//         },
//         body: JSON.stringify(requestBody)
//     })
//     .then(response => response.json())
//     .then(data => {
//         document.getElementById('result').innerHTML = `<p>${data.response || JSON.stringify(data)}</p>`;
//     })
//     .catch(error => {
//         console.error('Error:', error);
//         document.getElementById('result').innerHTML = '<p>Error occurred.</p>';
//     });
// }



// added by rejina

async function fetchAboutData() {
    try {
        const response = await fetch('http://localhost:8000/about');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Now, you can use the data to populate your HTML
        updateAboutPage(data);

    } catch (error) {
        console.error('Failed to fetch about data:', error);
    }
}

// Function to update the HTML with the fetched data
function updateAboutPage(data) {
    // Select the HTML elements you want to update
    const titleElement = document.querySelector('.about-section h1');
    const missionElement = document.querySelector('.mission-statement');

    // Update the text content
    if (titleElement) {
        titleElement.textContent = data.title;
    }
    if (missionElement) {
        missionElement.textContent = data.mission_statement;
    }

    // You can also dynamically create elements for the team members
    const teamGrid = document.querySelector('.team-grid');
    if (teamGrid) {
        teamGrid.innerHTML = ''; // Clear existing content  
        data.team.forEach(member => {
            const memberCard = document.createElement('div');
            memberCard.className = 'team-card';
            memberCard.innerHTML = `
                <h3>${member.name}</h3>
                <p>${member.role}</p>
            `;
            teamGrid.appendChild(memberCard);
        });
    }
}

// Call the function when the page loads
document.addEventListener('DOMContentLoaded', fetchAboutData);



// FOR SIGN UP: 
document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');

    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Basic validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('Please enter a valid email address.');
            return;
        }
        if (password !== confirmPassword) {
            alert('Passwords do not match.');
            return;
        }
        if (password.length < 6) {
            alert('Password must be at least 6 characters long.');
            return;
        }

        // Mock signup logic (replace with actual API call)
        alert(`Signup successful for ${username}!`);
        window.location.href = 'login.html'; // Redirect to login page
    });
});

 // Login Form Validation
        document.querySelector("form").addEventListener("submit", function (e) {
            const email = document.getElementById("email");
            const password = document.getElementById("password");
            let valid = true;
            // Email validation
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(email.value)) {
                email.style.borderColor = "red";
                valid = false;
            } else {
                email.style.borderColor = "#AEC6E4";
            }
            const passwordError = document.getElementById("password-error");
            // Password validation: 1 uppercase, 1 special char, 1 number, min 8 chars
            const passwordPattern =
                /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])(?=.*\d).{8,}$/;
            if (!passwordPattern.test(password.value)) {
                password.style.borderColor = "red";
                passwordError.textContent =
                    "Password must be at least 8 characters, include one uppercase letter, one number, and one special character.";
                passwordError.style.display = "block";
                valid = false;
            } else {
                password.style.borderColor = "#AEC6E4";
                passwordError.textContent = "";
                passwordError.style.display = "none";
            }
            if (!valid) {
                e.preventDefault();
            } else {
                // Success action: Redirect to home page after valid login
                alert(`Login successful for ${email.value}!`);
                window.location.href = 'home.html'; // Redirect to home page
                e.preventDefault(); // Prevent default form submission to avoid page reload
            }
        });         