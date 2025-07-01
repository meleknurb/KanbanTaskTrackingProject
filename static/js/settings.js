// settings.js
import { showNotification } from './notification.js'; 

document.addEventListener("DOMContentLoaded", () => {
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    const emailForm = document.getElementById("emailForm");
    const passwordForm = document.getElementById("passwordForm");

    if (emailForm) {
        emailForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(emailForm);
            const jsonData = {};
            formData.forEach((value, key) => { jsonData[key] = value; });

            console.log("Attempting to send email update request...");

            try {
                // E-posta güncelleme için yeni rota: /update_email
                const response = await fetch('/update_email', { 
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify(jsonData)
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log("Email update response received:", result);
                    if (result.success) {
                        showNotification(result.message, "success");
                        emailForm.reset();
                    } else {
                        let errorMessage = result.message || "Failed to update email.";
                        if (result.errors) {
                            for (const field in result.errors) {
                                errorMessage += ` ${field}: ${Object.values(result.errors[field]).join(', ')}.`;
                            }
                        }
                        showNotification(errorMessage, "error");
                    }
                } else {
                    let errorResponseText = await response.text();
                    let errorData;
                    try {
                        errorData = JSON.parse(errorResponseText);
                    } catch (parseError) {
                        errorData = { message: errorResponseText };
                    }
                    console.error("Email update request failed (response not OK):", errorData);
                    let errorMessage = errorData.message || "An unexpected server error occurred on email update.";
                    if (errorData.errors) {
                        for (const field in errorData.errors) {
                            errorMessage += ` ${field}: ${Object.values(errorData.errors[field]).join(', ')}.`;
                        }
                    }
                    showNotification(errorMessage, "error");
                }
            } catch (error) {
                console.error("Email update request error (network/parsing):", error);
                showNotification("A network error occurred during email update.", "error");
            }
        });
    }

    if (passwordForm) {
        passwordForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(passwordForm);
            const jsonData = {};
            formData.forEach((value, key) => { jsonData[key] = value; });

            console.log("Attempting to send password update request...");

            try {
                // Şifre güncelleme için yeni rota: /update_password
                const response = await fetch('/update_password', { 
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify(jsonData)
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log("Password update response received:", result);
                    if (result.success) {
                        showNotification(result.message, "success");
                        passwordForm.reset();
                    } else {
                        let errorMessage = result.message || "Failed to update password.";
                        if (result.errors) {
                            for (const field in result.errors) {
                                errorMessage += ` ${field}: ${Object.values(result.errors[field]).join(', ')}.`;
                            }
                        }
                        showNotification(errorMessage, "error");
                    }
                } else {
                    let errorResponseText = await response.text();
                    let errorData;
                    try {
                        errorData = JSON.parse(errorResponseText);
                    } catch (parseError) {
                        errorData = { message: errorResponseText };
                    }
                    console.error("Password update request failed (response not OK):", errorData);
                    let errorMessage = errorData.message || "An unexpected server error occurred on password update.";
                    if (errorData.errors) {
                        for (const field in errorData.errors) {
                            errorMessage += ` ${field}: ${Object.values(errorData.errors[field]).join(', ')}.`;
                        }
                    }
                    showNotification(errorMessage, "error");
                }
            } catch (error) {
                console.error("Password update request error (network/parsing):", error);
                showNotification("A network error occurred during password update.", "error");
            }
        });
    }

    // Hesap silme butonu için olay dinleyici (değişiklik yok)
    const deleteAccountBtn = document.getElementById("deleteAccountBtn");
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener("click", async (e) => {
            e.preventDefault();

            try {
                const response = await fetch('/delete_account', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    }
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        showNotification(result.message, "success"); 
                        setTimeout(() => {
                            window.location.href = '/';
                        }, 2000);
                    } else {
                        showNotification(result.message || "Failed to delete account.", "error");
                    }
                } else {
                    const errorData = await response.json();
                    showNotification("An error occurred while deleting the account: " + (errorData.message || "Unknown Error"), "error");
                }
            } catch (error) {
                console.error("Account delete request error:", error);
                showNotification("A network error occurred while deleting the account.", "error");
            }
        });
    }
});
