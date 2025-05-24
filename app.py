# app.py
from flask import Flask, render_template, request, redirect, url_for, jsonify

app = Flask(__name__)

# Basit görev yapısı (veritabanı yerine geçici liste)
tasks = {
    "todo": [],
    "in_progress": [],
    "done": []
}

# Yeni: Basit bir ID sayacı
task_id_counter = 0

def get_next_task_id():
    global task_id_counter
    task_id_counter += 1
    return task_id_counter

@app.route("/")
def index():
    return render_template("index.html", tasks=tasks)

@app.route("/add", methods=["POST"])
def add_task():
    # Frontend'den gelen form verisini al
    title = request.form["title"]
    description = request.form.get("description", "")
    column = "todo" # Görevler varsayılan olarak "To Do" sütununa eklenir

    if title:
        new_id = get_next_task_id() # Yeni benzersiz ID al
        # Görev sözlüğüne 'id' anahtarını ekleyin
        task = {"id": new_id, "title": title, "desc": description}
        tasks[column].append(task)
        # Add butonu submit edildiğinde sayfanın yenilenmesini beklediğimiz için redirect kullanıyoruz.
        return redirect(url_for("index"))
    
    # Başlık boşsa hata ver (bu durumda frontend zaten alert gösterecek)
    return redirect(url_for("index")) # Yinede ana sayfaya yönlendir

@app.route("/move_task", methods=["POST"])
def move_task():
    # Bu kısım JS'den gelen JSON verisini bekler
    data = request.get_json()
    
    # Güvenli erişim için .get() kullanıyoruz
    task_id = data.get("task_id")
    new_column = data.get("new_column")
    original_column = data.get("original_column")

    # Eksik veri kontrolü
    if not all([task_id, new_column, original_column]):
        return jsonify({"error": "Missing data for move operation"}), 400

    moved_task = None
    
    # task_id'yi integer'a dönüştürerek tip uyuşmazlığını gider
    try:
        task_id = int(task_id)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid task_id format"}), 400

    # Önce orijinal sütundan görevi bul ve çıkar
    for i, task in enumerate(tasks[original_column]):
        if task["id"] == task_id:
            moved_task = tasks[original_column].pop(i)
            break
    
    if moved_task:
        # Sonra yeni sütuna ekle
        tasks[new_column].append(moved_task)
        return jsonify({"message": "Task moved successfully", "task": moved_task}), 200
    
    # Görev bulunamadıysa hata mesajı dön
    return jsonify({"error": "Task not found in original column"}), 404

if __name__ == "__main__":
    app.run(debug=True)