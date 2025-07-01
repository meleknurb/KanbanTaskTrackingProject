// dashboard.js

import { showNotification } from './notification.js';

document.addEventListener("DOMContentLoaded", () => {

    let draggedElement = null;
    let originalColumn = null;
    let editorInstance = null; 
    let editEditorInstance = null; 

    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    const taskDescriptionElement = document.querySelector('#taskDescription');
    if (taskDescriptionElement) { 
        ClassicEditor
            .create(taskDescriptionElement, {
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
    }

    /**
     * @param {HTMLElement} columnElement
     */
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

    /**
    @param {HTMLElement} task
     */
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
            if (e.target.closest(".edit-icon") || e.target.closest(".delete-icon")) {
                return;
            }
            if (draggedElement?.classList.contains("dragging")) return;

            const title = task.querySelector(".task-title")?.textContent || "";
            const desc = task.getAttribute("data-description");
            const modalTitleElement = document.getElementById("modalTitle");
            const modalDescElement = document.getElementById("modalDesc");
            const modalOverlayElement = document.getElementById("modalOverlay");
            const taskModalElement = document.getElementById("taskModal");

            if (modalTitleElement) modalTitleElement.textContent = title;
            if (modalDescElement) modalDescElement.innerHTML = desc || "<i>No description provided.</i>";
            if (modalOverlayElement) modalOverlayElement.style.display = "block";
            if (taskModalElement) taskModalElement.style.display = "block";
        });
    }

    document.querySelectorAll(".task").forEach(enableTaskEvents);

    document.querySelectorAll(".column").forEach(column => {
        column.addEventListener("dragover", e => {
            e.preventDefault(); 
            e.dataTransfer.dropEffect = "move"; 
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

                if (originalColumn) {
                    requestAnimationFrame(() => adjustColumnHeight(originalColumn));
                }
                adjustColumnHeight(column);

                const taskId = draggedElement.getAttribute("data-id");
                const newColumnId = column.id;
                const originalColumnId = originalColumn?.id || null; 

                try {
                    const response = await fetch('/move_task', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrfToken
                        },
                        body: JSON.stringify({
                            task_id: taskId,
                            new_status: newColumnId,
                            original_status: originalColumnId
                        })
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        showNotification("Failed to move task: " + (errorData.message || "Unknown error"), "error");
                        if (originalColumn) {
                            originalColumn.querySelector(".task-list").appendChild(draggedElement);
                            adjustAllColumnHeights();
                        }
                    } 

                } catch (error) {
                    console.error("Move request error:", error);
                    showNotification("A network error occurred while moving the task.", "error");
                    if (originalColumn) {
                        originalColumn.querySelector(".task-list").appendChild(draggedElement);
                        adjustAllColumnHeights();
                    }
                }
            }
        });
    });

    const toggleBtn = document.getElementById("toggleBtn");
    const sidebar = document.getElementById("sidebar");
    const main = document.querySelector(".main");

    if (toggleBtn && sidebar && main) {
        toggleBtn.addEventListener("click", () => {
            const isOpen = sidebar.classList.contains("open");
            sidebar.classList.toggle("open", !isOpen);
            sidebar.classList.toggle("closed", isOpen);
            toggleBtn.innerHTML = isOpen ? "❯" : "❮";
            main.classList.toggle("shrink", !isOpen); 
            adjustAllColumnHeights(); 
        });
    }

    const modalCloseBtn = document.querySelector("#modalClose");
    const modalOverlay = document.getElementById("modalOverlay");
    const taskModal = document.getElementById("taskModal");

    function closeModal() {
        if (modalOverlay) modalOverlay.style.display = "none";
        if (taskModal) taskModal.style.display = "none";
    }

    if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
    if (modalOverlay) modalOverlay.addEventListener("click", closeModal);

    /**
     * @param {HTMLElement} container 
     * @param {number} y
     * @returns {HTMLElement|null}
     */
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

    adjustAllColumnHeights();

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

                        newTask.innerHTML = `
                            <div class="task-title">${result.task.title}</div>
                            <div class="edit-delete-icons">
                                <div class="edit-icon" title="Edit Card">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pencil-square" viewBox="0 0 16 16">
                                        <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.121z"/>
                                        <path fill-rule="evenodd" d="M1.5 13.5A.5.5 0 0 0 2 14v1a.5.5 0 0 0 .5.5h.5a.5.5 0 0 0 .5-.5V14a.5.5 0 0 0-.5-.5H2a.5.5 0 0 0-.5.5zm.5-1A.5.5 0 0 0 2 12v-.5a.5.5 0 0 0-1 0V12a.5.5 0 0 0 .5.5z"/>
                                    </svg>
                                </div>
                            `;

                        if (todoColumn) { 
                            todoColumn.appendChild(newTask);
                            enableTaskEvents(newTask);
                            adjustAllColumnHeights(); 
                        }
                        
                    } else {
                        let errorMessage = result.message || "Failed to add task.";
                        if (result.errors) {
                            for (const field in result.errors) {
                                errorMessage += ` ${field}: ${Object.values(result.errors[field]).join(', ')}.`;
                            }
                        }
                        showNotification(errorMessage, "error");
                    }
                } else {
                    const errorData = await response.json();
                    let errorMessage = errorData.message || "An unexpected server error occurred on add_task.";
                    if (errorData.errors) {
                        for (const field in errorData.errors) {
                            errorMessage += ` ${field}: ${Object.values(errorData.errors[field]).join(', ')}.`;
                        }
                    }
                    showNotification(errorMessage, "error");
                }
            } catch (error) {
                console.error("Task add request error:", error);
                showNotification("A network error occurred while adding the task.", "error");
            }
        });
    }

    document.querySelectorAll(".board").forEach(board => {
        board.addEventListener("click", async e => {
            const editIcon = e.target.closest(".edit-icon");
            const deleteIcon = e.target.closest(".delete-icon");

            if (editIcon) {
                const taskElement = editIcon.closest(".task");
                if (!taskElement) return;

                const taskId = taskElement.getAttribute("data-id");
                const taskTitle = taskElement.querySelector(".task-title").textContent;
                const taskDescription = taskElement.getAttribute("data-description");

                const editTaskIdElement = document.getElementById("editTaskId");
                const editTaskTitleElement = document.getElementById("editTaskTitle");
                const editDescriptionElement = document.getElementById("editTaskDescription");
                const editModalOverlayElement = document.getElementById("editModalOverlay");
                const editTaskModalElement = document.getElementById("editTaskModal");


                if (editTaskIdElement) editTaskIdElement.value = taskId;
                if (editTaskTitleElement) editTaskTitleElement.value = taskTitle;

                if (editDescriptionElement) {
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
                                    .catch(error => console.error("Error rebuilding CKEditor:", error));
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
                }

                if (editModalOverlayElement) editModalOverlayElement.style.display = "block";
                if (editTaskModalElement) editTaskModalElement.style.display = "block";
            } else if (deleteIcon) {
                const taskElement = deleteIcon.closest(".task");
                if (!taskElement) return;
                const taskIdToDelete = taskElement.getAttribute("data-id");
                deleteTask(taskIdToDelete);
            }
        });
    });


    const editModalCloseBtn = document.getElementById("editModalClose");
    const editModalOverlay = document.getElementById("editModalOverlay");
    const editTaskModal = document.getElementById("editTaskModal");

    function closeEditModal() {
        if (editModalOverlay) editModalOverlay.style.display = "none";
        if (editTaskModal) editTaskModal.style.display = "none";
        if (editEditorInstance) {
            editEditorInstance.destroy()
                .then(() => {
                    editEditorInstance = null;
                })
                .catch(error => console.error("CKEditor destroy error:", error));
        }
    }

    if (editModalCloseBtn) editModalCloseBtn.addEventListener("click", closeEditModal);
    if (editModalOverlay) editModalOverlay.addEventListener("click", closeEditModal);

    const saveEditBtn = document.getElementById("saveEditBtn");
    if (saveEditBtn) {
        saveEditBtn.addEventListener("click", async () => {
            const taskId = document.getElementById("editTaskId")?.value;
            const newTitle = document.getElementById("editTaskTitle")?.value;
            const newDescription = editEditorInstance ? editEditorInstance.getData() : ''; 

            if (!newTitle || !newTitle.trim()) {
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
                        showNotification(result.message, "success");
                        closeEditModal();
                    } else {
                        showNotification("Failed to update task: " + (result.message || "Unknown error"), "error");
                    }
                } else {
                    const errorData = await response.json();
                    showNotification("An error occurred while updating the task: " + (errorData.message || "Unknown Error"), "error");
                }
            } catch (error) {
                console.error("Task update request error:", error);
                showNotification("A network error occurred while updating the task.", "error");
            }
        });
    }

    /**
     * @param {string} taskIdToDelete
     */
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
                    showNotification(result.message, "success"); 
                    closeEditModal();
                } else {
                    showNotification("Failed to delete task: " + (result.message || "Unknown error"), "error");
                }
            } else {
                const errorData = await response.json();
                showNotification("An error occurred while deleting the task: " + (errorData.message || "Unknown Error"), "error");
            }
        } catch (error) {
            console.error("Task delete request error:", error);
            showNotification("A network error occurred while deleting the task.", "error");
        }
    }

    const deleteTaskBtnModal = document.getElementById("deleteTaskBtnModal");
    if (deleteTaskBtnModal) {
        deleteTaskBtnModal.addEventListener("click", () => {
            const taskIdToDelete = document.getElementById("editTaskId")?.value;
            if (taskIdToDelete) {
                deleteTask(taskIdToDelete);
            }
        });
    }
});
