// document.addEventListener('DOMContentLoaded', () => {
//     const signupForm = document.getElementById('signupForm');
//     const errorDiv = document.createElement('div');
//     errorDiv.style.color = 'red';
//     errorDiv.style.marginTop = '0.5rem';
//     signupForm.appendChild(errorDiv);

//     signupForm.addEventListener('submit', (e) => {
//         e.preventDefault();
//         const username = document.getElementById('username').value;
//         const email = document.getElementById('email').value;
//         const password = document.getElementById('password').value;
//         const confirmPassword = document.getElementById('confirmPassword').value;

//         // Clear previous error
//         errorDiv.textContent = '';

//         // Basic validation
//         const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//         if (!emailRegex.test(email)) {
//             errorDiv.textContent = 'Please enter a valid email address.';
//             return;
//         }
//         if (password !== confirmPassword) {
//             errorDiv.textContent = 'Passwords do not match.';
//             return;
//         }
//         if (password.length < 6) {
//             errorDiv.textContent = 'Password must be at least 6 characters long.';
//             return;
//         }

//         // Mock signup logic
//         alert(`Signup successful for ${username}!`);
//         window.location.href = 'login.html'; // Redirect to login page
//     });
// });

document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');
    const errorDiv = document.createElement('div');
    errorDiv.style.color = 'red';
    errorDiv.style.marginTop = '0.5rem';
    signupForm.appendChild(errorDiv);

    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        errorDiv.textContent = '';

        // Validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            errorDiv.textContent = 'Please enter a valid email address.';
            return;
        }
        if (password !== confirmPassword) {
            errorDiv.textContent = 'Passwords do not match.';
            return;
        }
        if (password.length < 6) {
            errorDiv.textContent = 'Password must be at least 6 characters long.';
            return;
        }

        // Store user in localStorage
        const users = JSON.parse(localStorage.getItem('setuUsers') || '[]');
        
        // Check if user already exists
        if (users.find(u => u.email === email)) {
            errorDiv.textContent = 'User with this email already exists.';
            return;
        }

        // Add new user
        users.push({ username, email, password });
        localStorage.setItem('setuUsers', JSON.stringify(users));

        alert('Registration successful!');
        window.location.href = 'login.html';
    });
});