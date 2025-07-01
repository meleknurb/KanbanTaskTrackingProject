// auth.js

import { showNotification } from './notification.js'; 

document.addEventListener("DOMContentLoaded", () => {
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    const loginForm = document.getElementById("loginForm");
    if (loginForm) { 
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(loginForm);
            const jsonData = {};
            formData.forEach((value, key) => { jsonData[key] = value; });

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify(jsonData)
                });

                if (response.ok) {
                    window.location.href = response.url; 
                } else {
                    const errorData = await response.json();
                    showNotification(errorData.message || "Login failed. Please try again.", "error");
                }
            } catch (error) {
                console.error("Login request error:", error);
                showNotification("A network error occurred during login.", "error");
            }
        });
    }

    const registerForm = document.getElementById("registerForm");
    if (registerForm) { 
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(registerForm);
            const jsonData = {};
            formData.forEach((value, key) => { jsonData[key] = value; });

            try {
                const response = await fetch('/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify(jsonData)
                });

                if (response.ok) {
                    window.location.href = response.url; 
                } else {
                    const errorData = await response.json();
                    showNotification(errorData.message || "Registration failed. Please try again.", "error");
                }
            } catch (error) {
                console.error("Register request error:", error);
                showNotification("A network error occurred during registration.", "error");
            }
        });
    }
});