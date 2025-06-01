document.addEventListener("DOMContentLoaded", () => {
    let draggedElement = null;
    let originalColumn = null;
    let editorInstance = null; // CKEditor instance'ını tutmak için

    ClassicEditor
        .create(document.querySelector('#taskDescription')) // #taskDescription textarea'sına bağlı olduğunu varsayalım
        .then(editor => {
             editorInstance = editor;
         })
         .catch(error => {
             console.error(error);
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

            setTimeout(() => {
                if (originalColumn) adjustColumnHeight(originalColumn);
            }, 0);
        });

        task.addEventListener("dragend", () => {
            if (draggedElement) draggedElement.classList.remove("dragging");
            adjustAllColumnHeights();
            draggedElement = null;
            originalColumn = null;
        });

        task.addEventListener("click", () => {
            if (draggedElement?.classList.contains("dragging")) return;

            const title = task.querySelector(".task-title")?.textContent || "";
            const desc = task.getAttribute("data-description");
            document.getElementById("modalTitle").textContent = title;
            document.getElementById("modalDesc").innerHTML = desc || "<i>No description provided.</i>";
            document.getElementById("modalOverlay").style.display = "block";
            document.getElementById("taskModal").style.display = "block";
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
                targetTaskList.appendChild(draggedElement);

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
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            task_id: taskId,
                            new_column: newColumnId,
                            original_column: originalColumnId
                        })
                    });

                    if (!response.ok) {
                        console.error("Backend taşımada hata. Geri alınıyor.");
                        if (originalColumn) {
                            originalColumn.querySelector(".task-list").appendChild(draggedElement);
                            adjustAllColumnHeights();
                        }
                    }
                } catch (error) {
                    console.error("Taşıma isteği hatası:", error);
                    if (originalColumn) {
                        originalColumn.querySelector(".task-list").appendChild(draggedElement);
                        adjustAllColumnHeights();
                    }
                }
            }
        });
    });

    // Sidebar
    const toggleBtn = document.getElementById("toggleBtn");
    const sidebar = document.getElementById("sidebar");
    const main = document.querySelector(".main");

    toggleBtn.addEventListener("click", () => {
        const isOpen = sidebar.classList.contains("open");
        sidebar.classList.toggle("open", !isOpen);
        sidebar.classList.toggle("closed", isOpen);
        main.classList.toggle("shrink", !isOpen);
        main.classList.toggle("expanded", isOpen);
        toggleBtn.innerHTML = isOpen ? "❯" : "❮";
    });

    function closeModal() {
        document.getElementById("modalOverlay").style.display = "none";
        document.getElementById("taskModal").style.display = "none";
    }

    document.querySelector(".close").addEventListener("click", closeModal);
    document.getElementById("modalOverlay").addEventListener("click", closeModal);

    // Yükseklikleri ayarla
    adjustAllColumnHeights();

    // ✅ AJAX Görev Ekleme
    const taskForm = document.getElementById("taskForm");
    if (taskForm) {
        taskForm.addEventListener("submit", async e => {
            e.preventDefault();

            // CKEditor verisini textarea'ya aktar
            if (editorInstance) {
                const description = editorInstance.getData();
                const descField = document.querySelector("textarea[name='description']");
                if (descField) descField.value = description;
            }

            const formData = new FormData(taskForm);
            const response = await fetch("/add", {
                method: "POST",
                body: formData,
                headers: {
                    "X-Requested-With": "XMLHttpRequest"
                }
            });

            if (response.ok) {
                const result = await response.json();

                if (result.success) {
                    // Formu temizle
                    taskForm.querySelector("#taskTitle").value = '';
                    if (editorInstance) {
                        editorInstance.setData(''); // CKEditor içeriğini temizle
                        // CKEditor'ın bağlı olduğu textarea'yı da temizle
                        taskForm.querySelector("textarea[name='description']").value = ''; 
                    }

                    // Yeni görevi oluştur
                    const todoColumn = document.querySelector("#todo .task-list");
                    const newTask = document.createElement("div");
                    newTask.classList.add("task");
                    newTask.setAttribute("draggable", "true");
                    newTask.setAttribute("data-id", result.task.id);
                    newTask.setAttribute("data-description", result.task.desc || "");
                    newTask.innerHTML = `<div class="task-title">${result.task.title}</div>`;

                    todoColumn.appendChild(newTask);
                    enableTaskEvents(newTask);
                    adjustAllColumnHeights();
                } else {
                    alert("Görev eklenemedi.");
                }
            } else {
                const errorData = await response.json();
                console.error("Form hatası:", errorData.errors);
                alert("Hatalı giriş: " + JSON.stringify(errorData.errors));
            }
        });
    }
});