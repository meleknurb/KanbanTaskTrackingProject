// static/script.js

document.addEventListener("DOMContentLoaded", () => {
    let draggedElement = null; // Sürüklenen DOM elementi
    let originalColumn = null; // Sürüklenen elementin orijinal sütunu

    // Görevlere event listener'ları ekleyen fonksiyon
    function enableTaskEvents(task) {
        task.addEventListener("dragstart", e => {
            draggedElement = task;
            originalColumn = task.closest(".column"); // Orijinal sütunu kaydet
            e.dataTransfer.effectAllowed = "move";
            // e.dataTransfer.setDragImage(task, 0, 0); // Bu satır kaldırıldı: Mavi çerçeve ve "hayalet" görseli engeller
            task.classList.add("dragging"); // Sürüklenirken stil ekle (opacity'yi CSS'ten kaldırdık)
        });

        task.addEventListener("dragend", () => {
            if (draggedElement) {
                draggedElement.classList.remove("dragging"); // Sürükleme bitince stili kaldır
                draggedElement = null;
                originalColumn = null;
            }
        });

        // Görev detay modalını açma
        task.addEventListener("click", () => {
            const title = task.querySelector(".task-title").textContent;
            const desc = task.getAttribute("data-description");
            document.getElementById("modalTitle").textContent = title;
            document.getElementById("modalDesc").textContent = desc || "No description provided."; // Açıklama yoksa mesaj göster
            document.getElementById("modalOverlay").style.display = "block";
            document.getElementById("taskModal").style.display = "block";
        });
    }

    // Sayfa yüklendiğinde mevcut görevlere eventleri uygula
    // app.py'dan gelen tasks verisindeki ID'leri de HTML'e ekleyelim
    document.querySelectorAll(".task").forEach(task => {
        // Eğer task'ın bir ID'si yoksa, dinamik olarak ekle (bu kısım backend'den ID gelene kadar geçici olabilir)
        // Ancak app.py'de artık ID ataması yapıldığı için bu kısım HTML'de ID'yi okuyacak.
        // Task'ın HTML yapısında data-id="some_id" şeklinde bir öznitelik olduğundan emin olun.
        enableTaskEvents(task);
    });

    // Sütunlara sürükle-bırak eventlerini ekle
    document.querySelectorAll(".column").forEach(column => {
        column.addEventListener("dragover", e => {
            e.preventDefault(); // Varsayılan davranışı engelle (drop'a izin ver)
            e.dataTransfer.dropEffect = "move"; // Sürükleme efekti
        });

        column.addEventListener("drop", async e => {
            e.preventDefault();
            if (draggedElement) {
                const targetTaskList = column.querySelector(".task-list");
                targetTaskList.appendChild(draggedElement);

                // Görev ID'sini data-id özniteliğinden al
                const taskId = draggedElement.getAttribute("data-id"); 
                const newColumnId = column.id;
                const originalColumnId = originalColumn ? originalColumn.id : null;

                // Backend'e AJAX isteği gönder
                try {
                    const response = await fetch('/move_task', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            task_id: taskId, // ID'yi gönderiyoruz
                            new_column: newColumnId,
                            original_column: originalColumnId
                        })
                    });

                    if (!response.ok) {
                        console.error("Failed to move task on backend.");
                        if (originalColumn) {
                            originalColumn.querySelector(".task-list").appendChild(draggedElement);
                        }
                    }
                } catch (error) {
                    console.error("Error sending move request:", error);
                    if (originalColumn) {
                        originalColumn.querySelector(".task-list").appendChild(draggedElement);
                    }
                }
            }
        });
    });

    // Sidebar toggle button logic
    const toggleBtn = document.getElementById("toggleBtn");
    const sidebar = document.getElementById("sidebar");
    const main = document.querySelector(".main");

    toggleBtn.addEventListener("click", () => {
        if (sidebar.classList.contains("open")) {
            // Close sidebar
            sidebar.classList.remove("open");
            sidebar.classList.add("closed");
            main.classList.remove("shrink");
            main.classList.add("expanded");
            toggleBtn.innerHTML = "❯"; // Ok yönünü sağa çevir
        } else {
            // Open sidebar
            sidebar.classList.remove("closed");
            sidebar.classList.add("open");
            main.classList.remove("expanded");
            main.classList.add("shrink");
            toggleBtn.innerHTML = "❮"; // Ok yönünü sola çevir
        }
    });

    // Add Task Form - Bu kısım, formun normal HTML submit davranışı ile çalışmasını sağlar.
    // Yani, formu gönderdiğinizde sayfa yenilenecektir.
    // app.py'daki request.form ile uyumludur.
    const addTaskForm = document.querySelector(".sidebar form");
    if (addTaskForm) {
        // Formun 'submit' event'i için herhangi bir preventDefault() yapılmıyor.
        // Bu sayede tarayıcı, formu normal bir HTML formu gibi sunucuya gönderir.
        // Bu kısımda başka bir değişiklik yapmanıza gerek yok.
    }

    // Modal close function
    function closeModal() {
        document.getElementById("modalOverlay").style.display = "none";
        document.getElementById("taskModal").style.display = "none";
    }

    document.querySelector(".close").addEventListener("click", closeModal);
    document.getElementById("modalOverlay").addEventListener("click", closeModal);
});