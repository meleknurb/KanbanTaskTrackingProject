document.addEventListener("DOMContentLoaded", () => {
    let draggedElement = null;
    let originalColumn = null;

    function adjustColumnHeight(columnElement) {
        if (!columnElement) return;

        const taskList = columnElement.querySelector(".task-list");
        const tasks = Array.from(taskList.querySelectorAll(".task"));

        // CSS tarafından otomatik yüksekliğe bırakmak için height stilini kaldırın
        // Bu, tarayıcının doğal yüksekliği hesaplamasına izin verir.
        columnElement.style.height = "auto"; 

        // Sütunun başlığı ve paddingleri için minimum bir yükseklik belirleyelim.
        // Kullanıcının isteği üzerine bu değeri 100 olarak tutuyoruz.
        const minHeightForColumnContent = 100; 

        let totalTasksHeight = 0;
        tasks.forEach(task => {
            // Her görevin kendi yüksekliğini ve altındaki margin'ini hesapla
            const taskComputedStyle = window.getComputedStyle(task);
            const taskMarginBottom = parseFloat(taskComputedStyle.marginBottom) || 0;
            totalTasksHeight += task.offsetHeight + taskMarginBottom;
        });

        const columnTitleElement = columnElement.querySelector("h3");
        const columnTitleHeight = columnTitleElement ? columnTitleElement.offsetHeight : 0;

        const columnStyle = window.getComputedStyle(columnElement);
        const columnPaddingTop = parseFloat(columnStyle.paddingTop) || 0;
        const columnPaddingBottom = parseFloat(columnStyle.paddingBottom) || 0;

        const taskListStyle = window.getComputedStyle(taskList);
        const taskListPaddingTop = parseFloat(taskListStyle.paddingTop) || 0;
        const taskListPaddingBottom = parseFloat(taskListStyle.paddingBottom) || 0;
        
        // Toplam yükseklik hesaplaması
        // Görevlerin toplam yüksekliği + sütun başlığı + sütun paddingleri + task list paddingleri
        let desiredHeight = columnTitleHeight + columnPaddingTop + columnPaddingBottom + 
                            taskListPaddingTop + taskListPaddingBottom + totalTasksHeight;

        // Eğer hiç görev yoksa, minimum yüksekliği kullan.
        if (tasks.length === 0) {
            desiredHeight = Math.max(desiredHeight, minHeightForColumnContent);
        } else {
            // Görev varsa, alt boşluğu azaltmak için küçük bir miktar çıkar.
            // Bu değeri (örneğin 10 veya 15) deneyerek en uygun sonucu bulabilirsiniz.
            // 15px, task'ın margin-bottom'ı (8px) ve column'ın padding-bottom'ı (15px) toplamı olan 23px'i azaltmaya yardımcı olur.
            desiredHeight -= 16; // Boşluğu azaltmak için 15 piksel çıkarıldı
            // Yine de minimum yüksekliğin altına düşmediğinden emin ol.
            desiredHeight = Math.max(desiredHeight, minHeightForColumnContent); 
        }

        // Yüksekliği ayarla.
        columnElement.style.height = `${desiredHeight}px`; 
    }

    function adjustAllColumnHeights() {
        document.querySelectorAll(".column").forEach(column => {
            adjustColumnHeight(column);
        });
    }

    function enableTaskEvents(task) {
        task.addEventListener("dragstart", e => {
            draggedElement = task;
            originalColumn = task.closest(".column");
            e.dataTransfer.effectAllowed = "move";
            task.classList.add("dragging");

            // Orijinal kodunuzdaki gibi, sürükleme başladığında orijinal sütunun yüksekliğini ayarla.
            // Bu, sürüklenen öğe hala DOM'da olsa bile, orijinal sütunun görünümünü günceller.
            setTimeout(() => {
                if (originalColumn) {
                    adjustColumnHeight(originalColumn);
                }
            }, 0);
        });

        task.addEventListener("dragend", () => {
            if (draggedElement) {
                draggedElement.classList.remove("dragging");
            }
            // Sürükleme bittiğinde tüm sütunların yüksekliğini tekrar düzenle
            // Bu, öğe yeni yerine yerleştirildikten sonra tüm sütunların doğru yüksekliğe sahip olmasını sağlar.
            adjustAllColumnHeights(); 
            draggedElement = null; // draggedElement'i sıfırla
            originalColumn = null; // originalColumn'ı sıfırla
        });

        task.addEventListener("click", () => {
            // Eğer sürükleme işlemi devam ediyorsa modalı açma
            if (draggedElement && draggedElement.classList.contains("dragging")) return;

            const title = task.querySelector(".task-title").textContent;
            const desc = task.getAttribute("data-description");
            document.getElementById("modalTitle").textContent = title;
            document.getElementById("modalDesc").textContent = desc || "No description provided.";
            document.getElementById("modalOverlay").style.display = "block";
            document.getElementById("taskModal").style.display = "block";
        });
    }

    // Mevcut tüm görevlere olay dinleyicilerini ekle
    document.querySelectorAll(".task").forEach(task => {
        enableTaskEvents(task);
    });

    document.querySelectorAll(".column").forEach(column => {
        column.addEventListener("dragover", e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            // Görevlerin arasına yerleştirme mantığını kaldırdık, sadece sürüklemeye izin veriyoruz.
            // Bu, orijinal kodunuzdaki sürükleme davranışını korur.
        });

        column.addEventListener("drop", async e => {
            e.preventDefault();
            if (draggedElement && draggedElement.parentNode) {
                const targetTaskList = column.querySelector(".task-list");
                // Orijinal kodunuzdaki gibi, sürüklenen öğeyi hedef listeye ekle
                targetTaskList.appendChild(draggedElement);

                // Drop sonrası hem hedef hem de orijinal sütunun yüksekliğini ayarla
                // Orijinal sütun hala mevcutsa onun da yüksekliğini güncelle
                if (originalColumn) {
                    // requestAnimationFrame kullanarak DOM güncellemesini tarayıcının sonraki çizim döngüsüne bırak
                    requestAnimationFrame(() => {
                        adjustColumnHeight(originalColumn);
                    });
                }
                adjustColumnHeight(column); // Hedef sütunun yüksekliğini ayarla

                const taskId = draggedElement.getAttribute("data-id");
                const newColumnId = column.id;
                const originalColumnId = originalColumn ? originalColumn.id : null;

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
                        console.error("Failed to move task on backend. Reverting changes.");
                        // Hata durumunda görevi orijinal sütununa geri taşı
                        if (originalColumn) {
                            originalColumn.querySelector(".task-list").appendChild(draggedElement);
                            adjustAllColumnHeights(); // Revert sonrası tüm sütunları ayarla
                        }
                    }
                } catch (error) {
                    console.error("Error sending move request:", error);
                    // Ağ hatası durumunda görevi orijinal sütununa geri taşı
                    if (originalColumn) {
                        originalColumn.querySelector(".task-list").appendChild(draggedElement);
                        adjustAllColumnHeights(); // Revert sonrası tüm sütunları ayarla
                    }
                } finally {
                    // draggedElement ve originalColumn dragend'de sıfırlanacak.
                }
            }
        });
    });

    // Sidebar toggle
    const toggleBtn = document.getElementById("toggleBtn");
    const sidebar = document.getElementById("sidebar");
    const main = document.querySelector(".main");

    toggleBtn.addEventListener("click", () => {
        if (sidebar.classList.contains("open")) {
            sidebar.classList.remove("open");
            sidebar.classList.add("closed");
            main.classList.remove("shrink");
            main.classList.add("expanded");
            toggleBtn.innerHTML = "❯";
        } else {
            sidebar.classList.remove("closed");
            sidebar.classList.add("open");
            main.classList.remove("expanded");
            main.classList.add("shrink");
            toggleBtn.innerHTML = "❮";
        }
    });

    function closeModal() {
        document.getElementById("modalOverlay").style.display = "none";
        document.getElementById("taskModal").style.display = "none";
    }

    document.querySelector(".close").addEventListener("click", closeModal);
    document.getElementById("modalOverlay").addEventListener("click", closeModal);

    // Sayfa yüklendiğinde tüm sütunların yüksekliğini ayarla
    adjustAllColumnHeights();

    // Yeni görev eklendiğinde yüksekliği güncellemek için formu dinleyebiliriz
    const addTaskForm = document.querySelector(".sidebar form");
    if (addTaskForm) {
        addTaskForm.addEventListener("submit", () => {
            // Form gönderildiğinde sayfa yenileniyorsa bu satır sadece bilgilendirme amaçlıdır.
            // AJAX ile ekleme yapıldığında faydalı olacaktır.
            setTimeout(adjustAllColumnHeights, 100); 
        });
    }
});
