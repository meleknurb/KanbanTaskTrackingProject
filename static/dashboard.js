document.addEventListener("DOMContentLoaded", () => {

    let draggedElement = null;
    let originalColumn = null;
    let editorInstance = null;
    let editEditorInstance = null;

    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    function showNotification(message, type = "success") {
        const notificationContainer = document.getElementById("notificationContainer");
        if (!notificationContainer) {
            console.error("No notification container found!");
            return;
        }

        const notification = document.createElement("div");
        notification.classList.add("notification-message");
        if (type === "error") {
            notification.classList.add("error");
        } else if (type === "success") {
            notification.classList.add("success");
        }
        notification.textContent = message;

        notificationContainer.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3500);
    }

    ClassicEditor
        .create(document.querySelector('#taskDescription'), {
            toolbar: {
                items: ['undo', 'redo', 'heading', '|', 'bold', 'italic', 'link',
                    'bulletedList', 'numberedList', 'blockQuote', 'outdent', 'indent'
                ]
            },
            link: {
                addTargetToExternalLinks: true
            }
        })
        .then(editor => {
            editorInstance = editor;
        })
        .catch(error => {
            console.error("Error starting CKEditor (insert form):", error);
        });

    function adjustColumnHeight(columnElement) {
        if (!columnElement) return;

        const taskList = columnElement.querySelector(".task-list");
        const tasks = Array.from(taskList.querySelectorAll(".task"));
        columnElement.style.height = "auto";
        const minHeight = 100;

        let totalHeight = 0;
        tasks.forEach(task => {
            const style = window.getComputedStyle(task);
            totalHeight += task.offsetHeight + (parseFloat(style.marginBottom) || 0);
        });

        const titleHeight = columnElement.querySelector("h3")?.offsetHeight || 0;
        const colStyle = window.getComputedStyle(columnElement);
        const colPaddingTop = parseFloat(colStyle.paddingTop) || 0;
        const colPaddingBottom = parseFloat(colStyle.paddingBottom) || 0;

        const taskListStyle = window.getComputedStyle(taskList);
        const tlPaddingTop = parseFloat(taskListStyle.paddingTop) || 0;
        const tlPaddingBottom = parseFloat(taskListStyle.paddingBottom) || 0;

        let height = titleHeight + colPaddingTop + colPaddingBottom + tlPaddingTop + tlPaddingBottom + totalHeight;
        height = tasks.length === 0 ? Math.max(height, minHeight) : Math.max(height - 16, minHeight);


        columnElement.style.height = `${height}px`;
    }

    function adjustAllColumnHeights() {
        document.querySelectorAll(".column").forEach(adjustColumnHeight);
    }

    function enableTaskEvents(task) {
        task.addEventListener("dragstart", e => {
            draggedElement = task;
            originalColumn = task.closest(".column");
            e.dataTransfer.effectAllowed = "move";
            task.classList.add("dragging");
        });

        task.addEventListener("dragend", () => {
            if (draggedElement) draggedElement.classList.remove("dragging");
            adjustAllColumnHeights();
            draggedElement = null;
            originalColumn = null;
        });

        task.addEventListener("click", (e) => {
            // Edit veya delete ikonuna tıklanmadıysa modalı aç
            // **Önemli:** SVG ikonlarının tıklamasını doğru yakalamak için `.closest('.edit-icon')` veya `.closest('.delete-icon')` kullanıyoruz.
            // SVG'nin kendisi veya içindeki path'ler tıklansa bile üst element olan `.edit-icon`'ı bulacaktır.
            if (e.target.closest(".edit-icon") || e.target.closest(".delete-icon")) {
                return;
            }

            // Sürükleme işlemi devam ediyorsa modalı açma
            if (draggedElement?.classList.contains("dragging")) return;

            const title = task.querySelector(".task-title")?.textContent || "";
            const desc = task.getAttribute("data-description");
            document.getElementById("modalTitle").textContent = title;
            document.getElementById("modalDesc").innerHTML = desc || "<i>No description provided.</i>";
            document.getElementById("modalOverlay").style.display = "block";
            document.getElementById("taskModal").style.display = "block";
        });
    }

    // Mevcut görevlere olay dinleyicilerini ata
    document.querySelectorAll(".task").forEach(enableTaskEvents);

    document.querySelectorAll(".column").forEach(column => {
        column.addEventListener("dragover", e => {
            e.preventDefault(); // Varsayılanı engelle (drop'u etkinleştirir)
            e.dataTransfer.dropEffect = "move"; // Sürükleme efekti
        });

        column.addEventListener("drop", async e => {
            e.preventDefault();
            if (draggedElement && draggedElement.parentNode) {
                const targetTaskList = column.querySelector(".task-list");

                const afterElement = getDragAfterElement(targetTaskList, e.clientY);

                if (afterElement == null) {
                    targetTaskList.appendChild(draggedElement);
                } else {
                    targetTaskList.insertBefore(draggedElement, afterElement);
                }
                // Sütun yüksekliklerini ayarla
                if (originalColumn) {
                    requestAnimationFrame(() => adjustColumnHeight(originalColumn));
                }
                adjustColumnHeight(column);

                const taskId = draggedElement.getAttribute("data-id");
                const newColumnId = column.id; // Yeni sütunun ID'si ('todo', 'in_progress', 'done')
                const originalColumnId = originalColumn?.id || null; // Orijinal sütunun ID'si

                try {
                    const response = await fetch('/move_task', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrfToken // CSRF token'ı ekle
                        },
                        body: JSON.stringify({
                            task_id: taskId,
                            new_status: newColumnId,
                            original_status: originalColumnId
                        })
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        try {
                            const errorData = JSON.parse(errorText);
                            console.error("Error in backend migration. Details:", errorData);
                        } catch (jsonError) {
                            console.error("Server returned non-JSON error:", errorText);
                        }
                        if (originalColumn) {
                            originalColumn.querySelector(".task-list").appendChild(draggedElement);
                            adjustAllColumnHeights();
                        }
                    } else {
                        console.log("Task moved successfully on backend.");
                    }
                } catch (error) {
                    console.error("Move request error:", error);
                    if (originalColumn) {
                        originalColumn.querySelector(".task-list").appendChild(draggedElement);
                        adjustAllColumnHeights();
                    }
                }
            }
        });
    });

    // Sidebar açma/kapama fonksiyonelliği
    const toggleBtn = document.getElementById("toggleBtn");
    const sidebar = document.getElementById("sidebar");
    const main = document.querySelector(".main");

    toggleBtn.addEventListener("click", () => {
        const isOpen = sidebar.classList.contains("open");
        sidebar.classList.toggle("open", !isOpen);
        sidebar.classList.toggle("closed", isOpen);
        toggleBtn.innerHTML = isOpen ? "❯" : "❮";
        main.classList.toggle("shrink", !isOpen);
        adjustAllColumnHeights();
    });

    // Modal kapatma fonksiyonları
    function closeModal() {
        document.getElementById("modalOverlay").style.display = "none";
        document.getElementById("taskModal").style.display = "none";
    }

    document.querySelector("#modalClose").addEventListener("click", closeModal);
    document.getElementById("modalOverlay").addEventListener("click", closeModal);

    // Sürükleme sırasında elementin yerini belirleme
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return {
                    offset: offset,
                    element: child
                };
            } else {
                return closest;
            }
        }, {
            offset: Number.NEGATIVE_INFINITY
        }).element;
    }

    // Sayfa yüklendiğinde tüm sütun yüksekliklerini ayarla
    adjustAllColumnHeights();

    // Yeni görev ekleme formu gönderimi
    const taskForm = document.getElementById("taskForm");
    if (taskForm) {
        taskForm.addEventListener("submit", async e => {
            e.preventDefault();

            if (editorInstance) {
                const description = editorInstance.getData();
                const descField = document.querySelector("textarea[name='description']");
                if (descField) descField.value = description;
            }

            const formData = new FormData(taskForm);

            try {
                const response = await fetch("/add_task", {
                    method: "POST",
                    body: formData,
                    headers: {
                        "X-Requested-With": "XMLHttpRequest"
                    }
                });

                if (response.ok) {
                    const result = await response.json();

                    if (result.success) {
                        taskForm.querySelector("#taskTitle").value = '';
                        if (editorInstance) {
                            editorInstance.setData('');
                            taskForm.querySelector("textarea[name='description']").value = '';
                        }

                        const todoColumn = document.querySelector("#todo .task-list");
                        const newTask = document.createElement("div");
                        newTask.classList.add("task");
                        newTask.setAttribute("draggable", "true");
                        newTask.setAttribute("data-id", result.task.id);
                        newTask.setAttribute("data-description", result.task.description || "");
                        newTask.setAttribute("data-status", result.task.status);

                        // **BURASI DÜZELTİLDİ: HTML'deki SVG ikon yapısı buraya kopyalandı.**
                        newTask.innerHTML = `
                            <div class="task-title">${result.task.title}</div>
                            <div class="edit-icon" title="Edit Card">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16">
                                    <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.121z"/>
                                    <path fill-rule="evenodd" d="M1.5 13.5A.5.5 0 0 0 2 14v1a.5.5 0 0 0 .5.5h.5a.5.5 0 0 0 .5-.5V14a.5.5 0 0 0-.5-.5H2a.5.5 0 0 0-.5.5zm.5-1A.5.5 0 0 0 2 12v-.5a.5.5 0 0 0-1 0V12a.5.5 0 0 0 .5.5z"/>
                                </svg>
                            </div>
                            `;

                        todoColumn.appendChild(newTask);
                        enableTaskEvents(newTask);
                        adjustAllColumnHeights();
                        console.log("Task added successfully.");
                    } else {
                        console.error("Backend reported failure:", result.errors);
                    }
                } else {
                    const errorText = await response.text();
                    try {
                        const errorData = JSON.parse(errorText);
                        console.error("Form submission error:", errorData.errors);
                        let errorMessage = "Incorrect entry. Please check the following: ";
                        for (const field in errorData.errors) {
                            errorMessage += `${field}: ${errorData.errors[field].join(', ')}. `;
                        }
                    } catch (jsonError) {
                        console.error("Server returned non-JSON error on add_task:", errorText);
                    }
                }
            } catch (error) {
                console.error("Task add request error:", error);
            }
        });
    }

    // Görev düzenleme ve silme modalı olayları
    document.querySelectorAll(".board").forEach(board => {
        board.addEventListener("click", async e => {
            const editIcon = e.target.closest(".edit-icon");
            const deleteIcon = e.target.closest(".delete-icon"); // Bu kısım henüz HTML'de yok ama JS'de tanımlı.

            if (editIcon) {
                const taskElement = editIcon.closest(".task");
                if (!taskElement) return;

                const taskId = taskElement.getAttribute("data-id");
                const taskTitle = taskElement.querySelector(".task-title").textContent;
                const taskDescription = taskElement.getAttribute("data-description");

                document.getElementById("editTaskId").value = taskId;
                document.getElementById("editTaskTitle").value = taskTitle;

                const editDescriptionElement = document.getElementById("editTaskDescription");

                if (editEditorInstance) {
                    editEditorInstance.destroy()
                        .then(() => {
                            ClassicEditor
                                .create(editDescriptionElement, {
                                    toolbar: {
                                        items: [
                                            'undo', 'redo', 'heading', '|', 'bold', 'italic', 'link',
                                            'bulletedList', 'numberedList', 'blockQuote', 'outdent', 'indent'
                                        ]
                                    },
                                    link: {
                                        addTargetToExternalLinks: true
                                    }
                                })
                                .then(editor => {
                                    editEditorInstance = editor;
                                    editEditorInstance.setData(taskDescription || '');
                                })
                                .catch(error => console.error("CKEditor yeniden oluşturulurken hata:", error));
                        });
                } else {
                    ClassicEditor
                        .create(editDescriptionElement, {
                            toolbar: {
                                items: [
                                    'undo', 'redo', 'heading', '|', 'bold', 'italic', 'link',
                                    'bulletedList', 'numberedList', 'blockQuote', 'outdent', 'indent'
                                ]
                            },
                            link: {
                                addTargetToExternalLinks: true
                            }
                        })
                        .then(editor => {
                            editEditorInstance = editor;
                            editEditorInstance.setData(taskDescription || '');
                        })
                        .catch(error => console.error("CKEditor oluşturulurken hata:", error));
                }

                document.getElementById("editModalOverlay").style.display = "block";
                document.getElementById("editTaskModal").style.display = "block";
            } else if (deleteIcon) {
                const taskElement = deleteIcon.closest(".task");
                if (!taskElement) return;
                const taskIdToDelete = taskElement.getAttribute("data-id");
                deleteTask(taskIdToDelete);
            }
        });
    });

    // Edit modal kapatma
    function closeEditModal() {
        document.getElementById("editModalOverlay").style.display = "none";
        document.getElementById("editTaskModal").style.display = "none";
        if (editEditorInstance) {
            editEditorInstance.destroy()
                .then(() => {
                    editEditorInstance = null;
                })
                .catch(error => console.error("CKEditor destroy error:", error));
        }
    }

    document.getElementById("editModalClose").addEventListener("click", closeEditModal);
    document.getElementById("editModalOverlay").addEventListener("click", closeEditModal);

    // Görev düzenleme butonuna tıklama
    document.getElementById("saveEditBtn").addEventListener("click", async () => {
        const taskId = document.getElementById("editTaskId").value;
        const newTitle = document.getElementById("editTaskTitle").value;
        const newDescription = editEditorInstance ? editEditorInstance.getData() : '';

        if (!newTitle.trim()) {
            showNotification("The task title cannot be left blank!", "error");
            return;
        }

        try {
            const response = await fetch('/edit_task', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({
                    task_id: taskId,
                    title: newTitle,
                    description: newDescription
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    const updatedTaskElement = document.querySelector(`.task[data-id="${taskId}"]`);
                    if (updatedTaskElement) {
                        updatedTaskElement.querySelector(".task-title").textContent = result.task.title;
                        updatedTaskElement.setAttribute("data-description", result.task.description);
                    }
                    showNotification("Task updated successfully!", "success");
                    closeEditModal();
                } else {
                    showNotification("Failed to update task: " + (result.error || "Unknown error"), "error");
                }
            } else {
                const errorText = await response.text();
                try {
                    const errorData = JSON.parse(errorText);
                    showNotification("An error occurred while updating the task: " + (errorData.error || "Unknown Error"), "error");
                } catch (jsonError) {
                    showNotification("An unexpected server error occurred on edit_task. Please check server logs.", "error");
                }
            }
        } catch (error) {
            console.error("Task update request error:", error);
            showNotification("A network error occurred while updating the task.", "error");
        }
    });

    // Görev silme fonksiyonu
    async function deleteTask(taskIdToDelete) {
        try {
            const response = await fetch('/delete_task', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({
                    task_id: taskIdToDelete
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    const taskElementToRemove = document.querySelector(`.task[data-id="${taskIdToDelete}"]`);
                    if (taskElementToRemove) {
                        const columnOfTask = taskElementToRemove.closest(".column");
                        taskElementToRemove.remove();
                        if (columnOfTask) {
                            adjustColumnHeight(columnOfTask);
                        }
                    }
                    showNotification("Task deleted successfully!", "success");
                    closeEditModal();
                } else {
                    showNotification("Failed to delete task: " + (result.error || "Unknown error"), "error");
                }
            } else {
                const errorText = await response.text();
                try {
                    const errorData = JSON.parse(errorText);
                    showNotification("An error occurred while deleting the task: " + (errorData.error || "Unknown Error"), "error");
                } catch (jsonError) {
                    showNotification("An unexpected server error occurred on delete_task. Please check server logs.", "error");
                }
            }
        } catch (error) {
            console.error("Task delete request error:", error);
            showNotification("A network error occurred while deleting the task.", "error");
        }
    }

    // Modal içindeki silme butonu
    document.getElementById("deleteTaskBtnModal").addEventListener("click", () => {
        const taskIdToDelete = document.getElementById("editTaskId").value;
        if (taskIdToDelete) {
            deleteTask(taskIdToDelete);
        }
    });
});