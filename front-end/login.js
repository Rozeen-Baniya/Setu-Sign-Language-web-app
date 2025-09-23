// // login.js

// document.addEventListener("DOMContentLoaded", () => {
//     const loginForm = document.getElementById("loginForm");
//     const usernameInput = document.getElementById("username");
//     const passwordInput = document.getElementById("password");
//     const errorDiv = document.getElementById("login-error"); // Make sure you have this element in your HTML

//     if (loginForm) {
//         loginForm.addEventListener("submit", async (e) => {
//             e.preventDefault();

//             const username = usernameInput.value;
//             const password = passwordInput.value;

//             // Clear previous errors
//             if (errorDiv) {
//                 errorDiv.textContent = "";
//             }

//             // Create URLSearchParams for x-www-form-urlencoded
//             const loginData = new URLSearchParams();
//             loginData.append("username", username);
//             loginData.append("password", password);

//             try {
//                 const response = await fetch("http://localhost:8000/token", {
//                     method: "POST",
//                     headers: {
//                         "Content-Type": "application/x-www-form-urlencoded",
//                     },
//                     body: loginData,
//                 });

//                 const result = await response.json();

//                 if (response.ok) {
//                     // Store the access token and redirect
//                     localStorage.setItem("access_token", result.access_token);
//                     alert("Login successful!");
//                     window.location.href = "transcribe.html"; // Redirect to a protected page
//                 } else {
//                     // Display error message from the backend
//                     if (errorDiv) {
//                         errorDiv.textContent = result.detail || "Login failed. Please check your credentials.";
//                     }
//                 }
//             } catch (error) {
//                 console.error("Error during login:", error);
//                 if (errorDiv) {
//                     errorDiv.textContent = "An error occurred. Please check your network connection.";
//                 }
//             }
//         });
//     }
// });